import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { DocumentEntity, Annotation, AnnotationType } from '../../types';
import { db } from '../../db';
import { pdfjsLib } from '../../services/pdf/extractor';
import { AnnotationLayer } from './annotation-layer';
import { AISuggestionsModal } from './ai-suggestions-modal';
import { StepsModeModal } from './steps-mode';
import { Button } from '../ui/button';
import { Modal } from '../ui/modal';
import { useAI } from '../../context/ai-context';
import { useWorkspace } from '../../context/workspace-context';
import { chunkDocumentPages, retrieveRelevantChunks, buildRAGPrompt } from '../../services/ai/rag';
import { ollama } from '../../services/ai/ollama';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';
import { autoAnnotator, DocumentEvidenceNote } from '../../services/documents/auto-annotator';
import { DocumentNotesModal } from './document-notes-modal';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Highlighter,
  Square,
  Hash,
  MessageSquare,
  Sparkles,
  ListOrdered,
  Send,
  Save,
  Trash2,
  CheckCircle,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  FileText,
  Download,
  Mic,
  MicOff,
} from 'lucide-react';
import { LiveSpeechTranscriber } from '../../services/audio/transcriber';

interface PDFViewerProps {
  document: DocumentEntity;
  onDeleted?: () => void;
  onToggleList?: () => void;
  isListOpen?: boolean;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({
  document: docEntity,
  onDeleted,
  onToggleList,
  isListOpen,
}) => {
  const { selectedModel, isConnected } = useAI();
  const { addToast, setActiveView, setActiveNoteId } = useWorkspace();

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [activeTool, setActiveTool] = useState<AnnotationType | null>(null);
  const [isAssistantOpen, setIsAssistantOpen] = useState<boolean>(() => {
    return typeof window !== 'undefined' && window.innerWidth >= 1280;
  });

  // Text selection floating toolbar state
  const [selectedText, setSelectedText] = useState('');
  const [selectionToolbarPos, setSelectionToolbarPos] = useState<{ x: number; y: number } | null>(
    null
  );

  // Modals state
  const [isSuggestionsModalOpen, setIsSuggestionsModalOpen] = useState(false);
  const [isStepsModalOpen, setIsStepsModalOpen] = useState(false);

  // AI Document Assistant panel state
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSources, setAiSources] = useState<Array<{ pageNumber: number; text: string }>>([]);
  const [compiledNotes, setCompiledNotes] = useState<DocumentEvidenceNote[]>([]);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [autoBoxoutEnabled, setAutoBoxoutEnabled] = useState(true);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isQuestionDictating, setIsQuestionDictating] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textDocRef = useRef<HTMLDivElement>(null);
  const textContentRef = useRef<HTMLDivElement>(null);
  const questionTranscriberRef = useRef<LiveSpeechTranscriber | null>(null);

  useEffect(() => {
    questionTranscriberRef.current = new LiveSpeechTranscriber();
    return () => {
      questionTranscriberRef.current?.stop();
    };
  }, []);

  const toggleQuestionDictation = async () => {
    if (isQuestionDictating) {
      questionTranscriberRef.current?.stop();
      setIsQuestionDictating(false);
      addToast('Document question dictation stopped.', 'info');
    } else {
      try {
        await questionTranscriberRef.current?.start((seg) => {
          setAiQuestion((prev) => (prev ? `${prev} ${seg.text}` : seg.text));
        });
        setIsQuestionDictating(true);
        addToast('Listening... Speak your document question.', 'success');
      } catch {
        addToast('Microphone access denied.', 'error');
      }
    }
  };
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 600, height: 800 });

  const [isTextDocument, setIsTextDocument] = useState<boolean>(false);

  /**
   * Uses the browser's Range API to find the exact pixel position of an excerpt
   * in the rendered DOM. Returns percentage coordinates relative to the paper container.
   * Uses whitespace-normalized mapping so line breaks and formatting in extracted text
   * match rendered text with 100% precision.
   */
  const locateExcerptInDOM = useCallback((excerpt: string): { x: number; y: number; width: number; height: number; confidence: 'exact' | 'partial' | 'fallback'; matchedText: string } | null => {
    const textEl = textContentRef.current;
    const containerEl = textDocRef.current;
    if (!textEl || !containerEl) return null;

    // Walk all text nodes in the content div
    const walker = document.createTreeWalker(textEl, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let tNode: Node | null;
    while ((tNode = walker.nextNode())) {
      textNodes.push(tNode as Text);
    }
    if (textNodes.length === 0) return null;

    // Build full text and a map of each node's start/end char index
    let fullText = '';
    const nodeMap: Array<{ node: Text; start: number; end: number }> = [];
    for (const tn of textNodes) {
      const s = fullText.length;
      const content = tn.textContent || '';
      fullText += content;
      nodeMap.push({ node: tn, start: s, end: s + content.length });
    }

    // Build normalized string with index mapping back to original fullText
    const normMap: number[] = [];
    let normFull = '';
    for (let i = 0; i < fullText.length; i++) {
      const ch = fullText[i];
      if (/\s/.test(ch)) {
        if (normFull.length === 0 || normFull[normFull.length - 1] !== ' ') {
          normMap.push(i);
          normFull += ' ';
        }
      } else {
        normMap.push(i);
        normFull += ch.toLowerCase();
      }
    }

    const excerptNorm = excerpt.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!excerptNorm) return null;

    let matchStart = -1;
    let matchLen = 0;
    let confidence: 'exact' | 'partial' | 'fallback' = 'exact';
    let matchedText = '';

    // Strategy 1: Exact match in whitespace-normalized text
    let nIdx = normFull.indexOf(excerptNorm);
    if (nIdx !== -1) {
      const origStart = normMap[nIdx];
      const origEnd = normMap[Math.min(normMap.length - 1, nIdx + excerptNorm.length - 1)] + 1;
      matchStart = origStart;
      matchLen = origEnd - origStart;
      matchedText = fullText.slice(matchStart, matchStart + matchLen);
    }

    // Strategy 2: First 60-80 characters of excerpt
    if (matchStart === -1 && excerptNorm.length > 40) {
      const sub = excerptNorm.slice(0, 60).trim();
      nIdx = normFull.indexOf(sub);
      if (nIdx !== -1) {
        const origStart = normMap[nIdx];
        const origEnd = normMap[Math.min(normMap.length - 1, nIdx + sub.length - 1)] + 1;
        matchStart = origStart;
        matchLen = origEnd - origStart;
        matchedText = fullText.slice(matchStart, matchStart + matchLen);
        confidence = 'partial';
      }
    }

    // Strategy 3: Significant sentences from excerpt
    if (matchStart === -1) {
      const sentences = excerptNorm.split(/[.!?\n]/).map((s) => s.trim()).filter((s) => s.length > 15);
      for (const sent of sentences) {
        nIdx = normFull.indexOf(sent);
        if (nIdx !== -1) {
          const origStart = normMap[nIdx];
          const origEnd = normMap[Math.min(normMap.length - 1, nIdx + sent.length - 1)] + 1;
          matchStart = origStart;
          matchLen = origEnd - origStart;
          matchedText = fullText.slice(matchStart, matchStart + matchLen);
          confidence = 'partial';
          break;
        }
      }
    }

    // Strategy 4: Leading 4 to 8 words
    if (matchStart === -1) {
      const words = excerptNorm.split(' ').filter((w) => w.length > 2);
      for (let len = Math.min(words.length, 8); len >= 4; len--) {
        const phrase = words.slice(0, len).join(' ');
        nIdx = normFull.indexOf(phrase);
        if (nIdx !== -1) {
          const origStart = normMap[nIdx];
          const origEnd = normMap[Math.min(normMap.length - 1, nIdx + phrase.length - 1)] + 1;
          matchStart = origStart;
          matchLen = origEnd - origStart;
          matchedText = fullText.slice(matchStart, matchStart + matchLen);
          confidence = 'partial';
          break;
        }
      }
    }

    if (matchStart === -1) return null;

    // Find the start and end text nodes for the Range
    let startNode: Text | null = null;
    let startOffset = 0;
    let endNode: Text | null = null;
    let endOffset = 0;
    const matchEnd = matchStart + matchLen;

    for (const entry of nodeMap) {
      if (!startNode && matchStart >= entry.start && matchStart < entry.end) {
        startNode = entry.node;
        startOffset = matchStart - entry.start;
      }
      if (matchEnd > entry.start && matchEnd <= entry.end) {
        endNode = entry.node;
        endOffset = matchEnd - entry.start;
      }
    }

    if (!startNode || !endNode) return null;

    try {
      const range = document.createRange();
      range.setStart(startNode, Math.min(startOffset, startNode.length));
      range.setEnd(endNode, Math.min(endOffset, endNode.length));

      const rangeRect = range.getBoundingClientRect();
      const containerRect = containerEl.getBoundingClientRect();

      if (rangeRect.width === 0 || rangeRect.height === 0) return null;

      // Small padding around the box so it cleanly wraps the exact words
      const padX = 4;
      const padY = 2;
      const x = ((rangeRect.left - containerRect.left - padX) / containerRect.width) * 100;
      const y = ((rangeRect.top - containerRect.top - padY) / containerRect.height) * 100;
      const w = ((rangeRect.width + padX * 2) / containerRect.width) * 100;
      const h = ((rangeRect.height + padY * 2) / containerRect.height) * 100;

      return {
        x: Math.max(0.5, Math.round(x * 10) / 10),
        y: Math.max(0.5, Math.round(y * 10) / 10),
        width: Math.min(99, Math.round(w * 10) / 10),
        height: Math.max(1.8, Math.round(h * 10) / 10),
        confidence,
        matchedText,
      };
    } catch {
      return null;
    }
  }, []);

  // Load document from blob in IndexedDB (PDF or Text/DOCX/PPTX)
  useEffect(() => {
    let isMounted = true;
    async function loadPdf() {
      try {
        const storedBlob = await db.blobs.get(docEntity.fileBlobId);
        if (!storedBlob) throw new Error('Document binary file not found.');

        const isPdf =
          storedBlob.mimeType === 'application/pdf' ||
          docEntity.fileName.toLowerCase().endsWith('.pdf');

        if (isPdf) {
          try {
            const arrayBuffer = await storedBlob.data.arrayBuffer();
            const loadedPdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            if (isMounted) {
              setPdfDoc(loadedPdf);
              setIsTextDocument(false);
            }
            return;
          } catch (pdfErr) {
            console.warn('[HuskyNote] PDF parse fallback to digital paper:', pdfErr);
          }
        }

        // It is a PPTX, DOCX, TXT, or MD document
        if (isMounted) {
          setPdfDoc(null);
          setIsTextDocument(true);
        }
      } catch (err: any) {
        console.warn('[HuskyNote] Document load fallback:', err);
        if (isMounted) {
          setIsTextDocument(true);
        }
      }
    }

    loadPdf();
    return () => {
      isMounted = false;
    };
  }, [docEntity]);

  // Auto-generate AI overview if not already generated
  useEffect(() => {
    if (docEntity && !aiResponse && !isAiLoading && isConnected && selectedModel) {
      askDocumentAI(`Provide an executive summary and 3 key takeaways of this document: "${docEntity.title}"`);
    }
  }, [docEntity?.id, isConnected, selectedModel]);

  // Load saved annotations for document
  useEffect(() => {
    let isMounted = true;
    async function loadAnnotations() {
      const list = await db.annotations.where('documentId').equals(docEntity.id).toArray();
      if (isMounted) {
        setAnnotations(list);
      }
    }
    loadAnnotations();
    return () => {
      isMounted = false;
    };
  }, [docEntity.id]);

  // Render current PDF page on canvas
  const renderPage = useCallback(
    async (pageNum: number) => {
      if (!pdfDoc || !canvasRef.current) return;

      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setCanvasDimensions({ width: viewport.width, height: viewport.height });

      const renderContext = {
        canvasContext: context,
        viewport,
      };

      renderTaskRef.current = page.render(renderContext);
      try {
        await renderTaskRef.current.promise;
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn('[HuskyNote] Page render error:', err);
        }
      }
    },
    [pdfDoc, scale]
  );

  useEffect(() => {
    renderPage(currentPage);
  }, [currentPage, renderPage]);

  // Text selection handler
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 3) {
      const text = selection.toString().trim();
      setSelectedText(text);

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectionToolbarPos({
        x: rect.left + rect.width / 2,
        y: rect.top - 45,
      });
    } else {
      setSelectionToolbarPos(null);
    }
  };

  // Add annotation helper
  const addAnnotationAtCoords = async (type: AnnotationType, label?: string) => {
    const newAnn: Annotation = {
      id: `ann-${Date.now()}-${Math.random()}`,
      documentId: docEntity.id,
      pageNumber: currentPage,
      type,
      coords: {
        x: 10,
        y: 20 + (annotations.filter((a) => a.pageNumber === currentPage).length % 4) * 15,
        width: type === 'marker' ? 4 : 80,
        height: type === 'marker' ? 4 : 8,
      },
      color: type === 'rectangle' ? '#ef4444' : '#eab308',
      text: selectedText || undefined,
      label: label || (type === 'marker' ? `Step` : undefined),
      stepNumber:
        type === 'marker'
          ? annotations.filter((a) => a.pageNumber === currentPage && a.type === 'marker').length + 1
          : undefined,
      createdAt: Date.now(),
    };

    await db.annotations.put(newAnn);
    setAnnotations((prev) => [...prev, newAnn]);
    addToast('Annotation added to page.', 'success');
  };

  const handleRemoveAnnotation = async (id: string) => {
    await db.annotations.delete(id);
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    addToast('Annotation removed.', 'info');
  };

  // Selection Action Trigger
  const handleSelectionAction = async (action: 'explain' | 'summarize' | 'simplify' | 'note') => {
    setSelectionToolbarPos(null);
    if (!selectedText) return;

    if (action === 'note') {
      const noteId = `note-${Date.now()}`;
      await db.notes.put({
        id: noteId,
        title: `Excerpt from ${docEntity.title} (p.${currentPage})`,
        content: `> "${selectedText}"\n\n*Source: ${docEntity.title}, Page ${currentPage}*\n\n## Notes\n- `,
        tags: ['document', 'excerpt'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        versions: [],
      });
      addToast('Created note from selected excerpt.', 'success');
      setActiveNoteId(noteId);
      setActiveView('notes');
      return;
    }

    // AI question from selection
    const prompts = {
      explain: `Explain the following excerpt from Page ${currentPage} in clear terms: "${selectedText}"`,
      summarize: `Provide a concise 2-sentence summary of this excerpt from Page ${currentPage}: "${selectedText}"`,
      simplify: `Explain this text like I am completely new to the topic: "${selectedText}"`,
    };

    askDocumentAI(prompts[action]);
  };

  // Document Q&A with local RAG, dynamic auto-boxout, and screenshot evidence capture
  const askDocumentAI = async (queryText: string) => {
    if (!queryText.trim()) return;
    setIsAiLoading(true);
    setAiResponse('');
    setAiSources([]);

    try {
      // Chunk extracted pages
      const chunks = chunkDocumentPages(docEntity.extractedPages);
      // Lexical retrieval of top 4 chunks
      const relevant = retrieveRelevantChunks(queryText, chunks, 4);

      setAiSources(
        relevant.map((r) => ({
          pageNumber: r.pageNumber,
          text: r.text.slice(0, 120) + '...',
        }))
      );

      // Automatic Document Box-out Annotation & Screenshot Capture
      let screenshotDataUrl = '';
      const topChunk = relevant[0] || { pageNumber: currentPage, text: '' };
      const targetPage = topChunk.pageNumber || currentPage;
      const targetExcerpt = topChunk.text || '';

      const pageData = docEntity.extractedPages.find((p) => p.pageNumber === targetPage);
      const fullPageText = pageData?.text || targetExcerpt;
      const stepIdx = compiledNotes.length;

      // Use DOM Range API for text documents (truly dynamic), fallback to static method
      let coordResult: { x: number; y: number; width: number; height: number; confidence: 'exact' | 'partial' | 'fallback'; matchedText: string };

      if (isTextDocument && targetPage === currentPage) {
        // DOM-based location -- measures actual rendered text positions
        const domResult = locateExcerptInDOM(targetExcerpt);
        coordResult = domResult || autoAnnotator.locateExcerptCoordinates(fullPageText, targetExcerpt);
      } else {
        coordResult = autoAnnotator.locateExcerptCoordinates(fullPageText, targetExcerpt);
      }

      const boxCoords = { x: coordResult.x, y: coordResult.y, width: coordResult.width, height: coordResult.height };

      if (autoBoxoutEnabled) {
        // Jump to referenced page so user immediately sees the highlight
        if (targetPage !== currentPage) {
          setCurrentPage(targetPage);
        }

        // Clean, readable label instead of arbitrary text slice
        const qLower = queryText.toLowerCase();
        const cleanLabel = qLower.includes('summar')
          ? 'Executive Summary'
          : qLower.includes('step')
          ? 'Key Steps'
          : qLower.includes('takeaway')
          ? 'Key Takeaways'
          : qLower.includes('requirement')
          ? 'Requirements'
          : `Note ${stepIdx + 1}`;

        // Add visual bounding box annotation with step-indexed color
        const autoAnn = autoAnnotator.createBoxoutAnnotation({
          documentId: docEntity.id,
          pageNumber: targetPage,
          coords: boxCoords,
          label: cleanLabel,
          text: targetExcerpt.slice(0, 180),
          stepIndex: stepIdx,
        });

        // Filter out any previous auto-boxouts on the same paragraph to avoid stacking duplicate boxes
        setAnnotations((prev) => [
          ...prev.filter(
            (a) =>
              !(
                a.pageNumber === targetPage &&
                a.type === 'rectangle' &&
                Math.abs(a.coords.y - boxCoords.y) < 6 &&
                Math.abs(a.coords.x - boxCoords.x) < 6
              )
          ),
          autoAnn,
        ]);
        await db.annotations.put(autoAnn);

        // Capture annotated screenshot of the document page
        if (isTextDocument || !pdfDoc) {
          screenshotDataUrl = autoAnnotator.captureDigitalPaperScreenshot({
            fileName: docEntity.fileName,
            pageNumber: targetPage,
            pageCount: docEntity.pageCount,
            pageText: fullPageText,
            boxCoords,
            label: queryText.slice(0, 20),
            stepIndex: stepIdx,
          });
        } else if (canvasRef.current) {
          screenshotDataUrl = autoAnnotator.capturePdfPageScreenshot(
            canvasRef.current,
            boxCoords,
            queryText.slice(0, 20),
            stepIdx
          );
        }
      }

      const prompt = buildRAGPrompt(queryText, relevant);

      let fullAiAnswer = '';

      if (!isConnected || !selectedModel) {
        fullAiAnswer = `Page ${targetPage} analysis: "${targetExcerpt.slice(0, 220)}..." -- Key content located and boxed out. Match confidence: ${coordResult.confidence}.`;
        setAiResponse(fullAiAnswer);
        setIsAiLoading(false);
      } else {
        await ollama.streamGenerate(
          prompt,
          (chunk) => {
            fullAiAnswer += chunk;
            setAiResponse((prev) => prev + chunk);
          },
          { model: selectedModel }
        );
      }

      // Compile into document evidence notes with step metadata
      const evidenceNote: DocumentEvidenceNote = {
        id: `docnote-${Date.now()}-${stepIdx + 1}`,
        documentId: docEntity.id,
        documentTitle: docEntity.title,
        pageNumber: targetPage,
        query: queryText,
        aiSummary: fullAiAnswer || 'Document section analyzed and boxed out.',
        excerpt: coordResult.matchedText || targetExcerpt.slice(0, 300),
        screenshotDataUrl,
        timestamp: Date.now(),
        stepIndex: stepIdx + 1,
        totalSteps: stepIdx + 1,
      };

      setCompiledNotes((prev) => [...prev, evidenceNote]);
      addToast(
        coordResult.confidence === 'exact'
          ? `Exact match found on Page ${targetPage} -- note captured.`
          : coordResult.confidence === 'partial'
          ? `Partial match located on Page ${targetPage} -- note captured.`
          : `Page ${targetPage} annotated and note captured.`,
        'success'
      );
    } catch (err: any) {
      setAiResponse(`Error generating response: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSaveAiAnswerAsNote = async () => {
    if (!aiResponse) return;
    try {
      const noteId = `note-${Date.now()}`;
      const noteContent = `# Document Intelligence: ${docEntity.title}\n\n**Query:** ${aiQuestion || 'Document Analysis'}\n\n${aiResponse}\n\n## Source Citations\n${aiSources.map((s) => `- Page ${s.pageNumber}: "${s.text}"`).join('\n')}`;
      await db.notes.put({
        id: noteId,
        title: `AI Analysis: ${docEntity.title}`,
        content: noteContent,
        tags: ['document', 'ai-analysis'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        versions: [
          {
            id: `v-${Date.now()}`,
            title: `AI Analysis: ${docEntity.title}`,
            content: noteContent,
            timestamp: Date.now(),
          },
        ],
      });
      addToast('Saved AI analysis to Notes.', 'success');
      setActiveNoteId(noteId);
      setActiveView('notes');
    } catch {
      addToast('Failed to save as note.', 'error');
    }
  };

  const confirmDeleteDocument = async () => {
    try {
      await db.documents.delete(docEntity.id);
      if (docEntity.fileBlobId) {
        await db.blobs.delete(docEntity.fileBlobId);
      }
      await db.annotations.where('documentId').equals(docEntity.id).delete();
      addToast(`Deleted "${docEntity.title}".`, 'info');
      setIsDeleteModalOpen(false);
      if (onDeleted) onDeleted();
    } catch (err: any) {
      console.error('[HuskyNote] Failed to delete document:', err);
      addToast(`Failed to delete document: ${err?.message || 'Unknown error'}`, 'error');
    }
  };

  const handleClearAllAnnotations = async () => {
    try {
      await db.annotations.where('documentId').equals(docEntity.id).delete();
      setAnnotations([]);
      addToast('Cleared all annotations for this document.', 'info');
    } catch (err: any) {
      console.error('[HuskyNote] Failed to clear annotations:', err);
    }
  };

  const currentPageText =
    docEntity.extractedPages.find((p) => p.pageNumber === currentPage)?.text || '';

  return (
    <div
      className="flex-1 flex h-full bg-black overflow-hidden relative select-text"
      onMouseUp={handleMouseUp}
    >
      {/* Center Main: Document Canvas & Controls */}
      <div className="flex-1 flex flex-col h-full min-w-0 border-r border-zinc-850">
        {/* Top Viewer Controls */}
        <div className="h-12 border-b border-zinc-850 px-3 sm:px-4 flex items-center justify-between shrink-0 bg-zinc-950/60 gap-2 overflow-x-auto">
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {onToggleList && (
              <button
                onClick={onToggleList}
                className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
                title={isListOpen ? 'Hide document list' : 'Show document list'}
                aria-label={isListOpen ? 'Hide document list' : 'Show document list'}
              >
                {isListOpen ? (
                  <PanelLeftClose className="w-3.5 h-3.5" />
                ) : (
                  <PanelLeftOpen className="w-3.5 h-3.5" />
                )}
              </button>
            )}

            <span className="text-xs font-semibold text-zinc-200 truncate max-w-[120px] sm:max-w-[200px]">
              {docEntity.title}
            </span>

            <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-850 rounded px-1.5 py-0.5 text-xs font-mono text-zinc-400">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1 hover:text-white disabled:opacity-30"
                title="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px]">
                {currentPage} / {docEntity.pageCount}
              </span>
              <button
                disabled={currentPage >= docEntity.pageCount}
                onClick={() => setCurrentPage((p) => Math.min(docEntity.pageCount, p + 1))}
                className="p-1 hover:text-white disabled:opacity-30"
                title="Next page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Zoom and Annotation Tools */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="hidden sm:flex items-center bg-zinc-900 border border-zinc-800 rounded px-1">
              <button
                onClick={() => setScale((s) => Math.max(0.6, s - 0.2))}
                className="p-1 text-zinc-400 hover:text-white"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono text-zinc-400 px-1.5">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => setScale((s) => Math.min(2.5, s + 0.2))}
                className="p-1 text-zinc-400 hover:text-white"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="hidden md:block w-px h-4 bg-zinc-800 mx-0.5" />

            {/* Quick manual annotation buttons */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => addAnnotationAtCoords('highlight')}
              title="Add Highlight Box"
              className="px-2"
            >
              <Highlighter className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Highlight</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => addAnnotationAtCoords('rectangle', 'Caution')}
              title="Add Warning Box"
              className="px-2"
            >
              <Square className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Box</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => addAnnotationAtCoords('marker')}
              title="Add Numbered Step Badge"
              className="px-2"
            >
              <Hash className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Step Badge</span>
            </Button>

            <div className="w-px h-4 bg-zinc-800 mx-0.5" />

            {/* AI Action Modals */}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setIsSuggestionsModalOpen(true)}
              title="Analyze Page for Suggestions"
              className="px-2"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Callouts</span>
            </Button>

            <Button
              size="sm"
              variant="secondary"
              onClick={() => setIsStepsModalOpen(true)}
              title="Transform Section into Numbered Steps"
              className="px-2"
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Steps</span>
            </Button>

            {/* Compiled Notes Button */}
            <Button
              size="sm"
              variant={compiledNotes.length > 0 ? 'secondary' : 'outline'}
              onClick={() => setIsNotesModalOpen(true)}
              title="View and download compiled document notes"
              className="px-2.5 flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-zinc-300" />
              <span className="hidden sm:inline">Compiled Notes</span>
              <span className="px-1.5 py-0.2 rounded-full bg-zinc-800 text-[10px] font-mono">
                {compiledNotes.length}
              </span>
            </Button>

            {/* AI Assistant Panel Toggle */}
            <Button
              size="sm"
              variant={isAssistantOpen ? 'primary' : 'outline'}
              onClick={() => setIsAssistantOpen((prev) => !prev)}
              title={isAssistantOpen ? 'Hide Assistant Panel' : 'Show Assistant Panel'}
              className="px-2.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-zinc-300" />
              <span className="hidden sm:inline">AI Assistant</span>
            </Button>

            {/* Clear Annotations Button */}
            {annotations.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleClearAllAnnotations}
                title="Clear all annotations on this document"
                className="text-zinc-400 hover:text-zinc-200 text-xs px-2"
              >
                Clear Boxes
              </Button>
            )}

            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsDeleteModalOpen(true)}
              title="Delete document"
              className="hover:bg-red-950/40 hover:text-red-400"
            >
              <Trash2 className="w-3.5 h-3.5 text-zinc-400 hover:text-red-400" />
            </Button>
          </div>
        </div>

        {/* Document Display Area (Canvas for PDF or Digital Reading Sheet for DOCX/PPTX/TXT) */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto p-8 flex items-start justify-center bg-zinc-950/40 select-text"
        >
          {isTextDocument ? (
            <div ref={textDocRef} className="relative paper-desk-shadow border border-zinc-750 bg-white rounded-sm w-full max-w-2xl min-h-[720px] p-10 flex flex-col justify-between text-zinc-900 shadow-2xl select-text">
              <div>
                {/* Header */}
                <div className="flex items-center justify-between border-b border-zinc-200 pb-3 mb-6 text-[10px] font-mono text-zinc-500 uppercase">
                  <span className="font-bold tracking-wider">
                    {docEntity.fileName.toLowerCase().endsWith('.pptx') || docEntity.fileName.toLowerCase().endsWith('.ppt')
                      ? `SLIDE ${currentPage} OF ${docEntity.pageCount}`
                      : `PAGE ${currentPage} OF ${docEntity.pageCount}`}
                  </span>
                  <span>{docEntity.fileName}</span>
                </div>

                {/* Page Content */}
                <div ref={textContentRef} className="text-sm font-sans text-zinc-900 leading-relaxed space-y-4 whitespace-pre-wrap font-normal select-text">
                  {currentPageText || 'Empty page content.'}
                </div>
              </div>

              {/* Footer */}
              <div className="pt-6 border-t border-zinc-200 flex items-center justify-between text-[10px] font-mono text-zinc-400">
                <span>LOCAL INDEXEDDB PERSISTED</span>
                <span>HUSKYNOTE INTELLIGENCE</span>
              </div>

              <AnnotationLayer
                annotations={annotations}
                pageNumber={currentPage}
                onRemoveAnnotation={handleRemoveAnnotation}
              />
            </div>
          ) : (
            <div className="relative paper-desk-shadow border border-zinc-750 bg-white rounded-sm">
              <canvas ref={canvasRef} className="block rounded-sm" />
              <AnnotationLayer
                annotations={annotations}
                pageNumber={currentPage}
                width={canvasDimensions.width}
                height={canvasDimensions.height}
                onRemoveAnnotation={handleRemoveAnnotation}
              />
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: AI Document Intelligence Assistant */}
      {isAssistantOpen && (
        <div className="w-80 lg:w-96 bg-zinc-950 flex flex-col h-full shrink-0 select-none border-l border-zinc-850 animate-fade-in">
          <div className="p-3.5 border-b border-zinc-850 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-zinc-300" />
              <span className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
                Document Assistant
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 font-mono">Page {currentPage}</span>
              <button
                onClick={() => setIsAssistantOpen(false)}
                className="p-1 text-zinc-500 hover:text-white rounded transition-colors"
                title="Close assistant panel"
                aria-label="Close assistant panel"
              >
                <PanelRightClose className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Question Chips with Auto-Boxout */}
          <div className="p-3 border-b border-zinc-850 flex flex-col gap-2 bg-zinc-950/60">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Quick Summaries</span>
              <button
                onClick={() => setAutoBoxoutEnabled(!autoBoxoutEnabled)}
                className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 hover:text-emerald-300 transition-colors"
                title="Toggle automatic document text box-out and screenshot"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    autoBoxoutEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'
                  }`}
                />
                <span>AUTO-BOXOUT: {autoBoxoutEnabled ? 'ON' : 'OFF'}</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => askDocumentAI('Summarize this page in 3 concise bullet points.')}
                className="text-[11px] text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 px-2 py-1 rounded transition-colors"
              >
                Summarize Page
              </button>
              <button
                onClick={() => askDocumentAI('What are the main procedural steps or actions required?')}
                className="text-[11px] text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 px-2 py-1 rounded transition-colors"
              >
                Main Steps
              </button>
              <button
                onClick={() => askDocumentAI('What are the critical requirements, warnings, or prerequisites?')}
                className="text-[11px] text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 px-2 py-1 rounded transition-colors"
              >
                Requirements
              </button>
              <button
                onClick={() => askDocumentAI('What are the 3 most important takeaways from this page?')}
                className="text-[11px] text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 px-2 py-1 rounded transition-colors"
              >
                Key Takeaways
              </button>
            </div>

            {compiledNotes.length > 0 && (
              <button
                onClick={() => setIsNotesModalOpen(true)}
                className="mt-0.5 w-full py-1.5 px-2.5 rounded bg-zinc-900 border border-zinc-750 text-xs text-zinc-200 hover:text-white hover:bg-zinc-850 flex items-center justify-between transition-colors shadow-sm"
              >
                <span className="flex items-center gap-1.5 font-medium">
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Review Compiled Notes</span>
                </span>
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-mono">
                  {compiledNotes.length}
                </span>
              </button>
            )}
          </div>

          {/* AI Conversation View */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {aiResponse ? (
              <div className="space-y-3">
                <div className="p-4 rounded-lg bg-zinc-900/70 border border-zinc-850 text-xs text-zinc-200 space-y-2 leading-relaxed">
                  <div className="font-semibold text-zinc-100 flex items-center justify-between">
                    <span>AI Response</span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      Sources: p.{currentPage}
                    </span>
                  </div>
                  <div className="markdown-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {DOMPurify.sanitize(aiResponse)}
                    </ReactMarkdown>
                  </div>
                </div>

                {/* Save as Note Action */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSaveAiAnswerAsNote}
                  className="w-full flex items-center justify-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Analysis as Note</span>
                </Button>
              </div>
            ) : isAiLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-500 space-y-3 text-xs">
                <Sparkles className="w-5 h-5 text-zinc-400 animate-spin" />
                <span>Reading document chunks and querying local Ollama...</span>
              </div>
            ) : (
              <div className="py-12 text-center text-zinc-500 space-y-2 text-xs">
                <MessageSquare className="w-6 h-6 mx-auto text-zinc-600" />
                <p>Ask any question about this document or click the chips above.</p>
                <p className="text-[10px] text-zinc-600">
                  Queries stay strictly local against client-side chunks.
                </p>
              </div>
            )}

            {/* Citations Card */}
            {aiSources.length > 0 && (
              <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-850 space-y-2 text-[11px]">
                <span className="font-semibold text-zinc-400 uppercase tracking-wider text-[10px]">
                  Citations
                </span>
                {aiSources.map((src, idx) => (
                  <div
                    key={idx}
                    onClick={() => setCurrentPage(src.pageNumber)}
                    className="p-2 rounded bg-zinc-900/60 border border-zinc-800/80 cursor-pointer hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex items-center justify-between font-mono text-[10px] text-zinc-400 mb-1">
                      <span>Page {src.pageNumber}</span>
                      <span className="text-emerald-400">Click to navigate</span>
                    </div>
                    <p className="text-zinc-300 line-clamp-2 italic text-[11px]">"{src.text}"</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Question Prompt Input */}
          <div className="p-3 border-t border-zinc-850 bg-zinc-950/80">
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 focus-within:border-zinc-700">
              <input
                type="text"
                placeholder="Ask document question..."
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isAiLoading) {
                    askDocumentAI(aiQuestion);
                    setAiQuestion('');
                  }
                }}
                disabled={isAiLoading}
                className="flex-1 bg-transparent text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={toggleQuestionDictation}
                className={`p-1.5 rounded transition-all ${
                  isQuestionDictating
                    ? 'bg-red-950/80 border border-red-700 text-white animate-pulse'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title={isQuestionDictating ? 'Stop speech dictation' : 'Dictate question with mic'}
              >
                {isQuestionDictating ? <Mic className="w-3.5 h-3.5 text-red-400" /> : <Mic className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => {
                  askDocumentAI(aiQuestion);
                  setAiQuestion('');
                }}
                disabled={isAiLoading || !aiQuestion.trim()}
                className="p-1 rounded text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Selection Contextual Toolbar */}
      {selectionToolbarPos && (
        <div
          style={{
            position: 'fixed',
            left: selectionToolbarPos.x,
            top: selectionToolbarPos.y,
            transform: 'translateX(-50%)',
          }}
          className="z-50 flex items-center gap-1 bg-zinc-900 border border-zinc-700 rounded-lg p-1 shadow-2xl animate-fade-in text-xs select-none"
        >
          <button
            onClick={() => handleSelectionAction('explain')}
            className="px-2 py-1 rounded text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            Explain
          </button>
          <button
            onClick={() => handleSelectionAction('summarize')}
            className="px-2 py-1 rounded text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            Summarize
          </button>
          <button
            onClick={() => handleSelectionAction('simplify')}
            className="px-2 py-1 rounded text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            Simplify
          </button>
          <div className="w-px h-3 bg-zinc-700 mx-0.5" />
          <button
            onClick={() => handleSelectionAction('note')}
            className="px-2 py-1 rounded text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            Make Note
          </button>
          <button
            onClick={() => {
              addAnnotationAtCoords('highlight');
              setSelectionToolbarPos(null);
            }}
            className="px-2 py-1 rounded text-yellow-300 hover:bg-zinc-800 transition-colors"
          >
            Highlight
          </button>
        </div>
      )}

      {/* Suggestions Modal */}
      {isSuggestionsModalOpen && (
        <AISuggestionsModal
          isOpen={isSuggestionsModalOpen}
          onClose={() => setIsSuggestionsModalOpen(false)}
          documentId={docEntity.id}
          currentPage={currentPage}
          pageText={currentPageText}
          onAcceptAnnotations={async (newAnns) => {
            await db.annotations.bulkPut(newAnns);
            setAnnotations((prev) => [...prev, ...newAnns]);
            addToast(`Applied ${newAnns.length} proposed annotations.`, 'success');
          }}
        />
      )}

      {/* Steps Mode Modal */}
      {isStepsModalOpen && (
        <StepsModeModal
          isOpen={isStepsModalOpen}
          onClose={() => setIsStepsModalOpen(false)}
          documentTitle={docEntity.title}
          sourcePage={currentPage}
          sourceText={selectedText || currentPageText.slice(0, 800)}
        />
      )}

      {/* Document Evidence Notes Compilation Modal */}
      <DocumentNotesModal
        isOpen={isNotesModalOpen}
        onClose={() => setIsNotesModalOpen(false)}
        documentTitle={docEntity.title}
        notes={compiledNotes}
        onRemoveNote={(id) => setCompiledNotes((prev) => prev.filter((n) => n.id !== id))}
        onClearNotes={() => setCompiledNotes([])}
      />

      {/* Delete Document Confirmation Modal */}
      {isDeleteModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsDeleteModalOpen(false)}
          title="Delete Document"
          description="Are you sure you want to delete this document? This action cannot be undone."
          maxWidth="sm"
        >
          <div className="p-6 space-y-4">
            <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center gap-3">
              <FileText className="w-5 h-5 text-zinc-300 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-zinc-100 truncate">{docEntity.title}</p>
                <p className="text-[10px] font-mono text-zinc-400">
                  {docEntity.fileName} • {(docEntity.fileSize / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              This will permanently remove the file, extracted pages, and all associated AI annotations and notes from your local storage.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDeleteModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={confirmDeleteDocument}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Permanently</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
