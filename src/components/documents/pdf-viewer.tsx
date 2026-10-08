import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import type { DocumentEntity, Annotation, AnnotationType } from '../../types';
import { db } from '../../db';
import { pdfjsLib } from '../../services/pdf/extractor';
import { AnnotationLayer } from './annotation-layer';
import { AISuggestionsModal } from './ai-suggestions-modal';
import { StepsModeModal } from './steps-mode';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Modal } from '../ui/modal';
import { Markdown } from '../ui/markdown';
import { Separator } from '../ui/separator';
import { Spinner } from '../ui/spinner';
import { StatusDot } from '../ui/status-dot';
import { Sheet, SheetContent, SheetTitle } from '../ui/sheet';
import { Toolbar, ToolbarGroup, ToolbarSeparator } from '../ui/toolbar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { cn } from '../../lib/utils';
import { useAI } from '../../context/ai-context';
import { PROVIDER_NAMES, PROVIDER_RECIPIENTS } from '../../services/ai/active-provider';
import { useWorkspace } from '../../context/workspace-context';
import { chunkDocumentPages, retrieveRelevantChunks, buildRAGPrompt } from '../../services/ai/rag';
import { ai } from '../../services/ai/active-provider';
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
  ArrowUp,
  Save,
  Trash2,
  Eraser,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  FileText,
  Mic,
} from 'lucide-react';
import { LiveSpeechTranscriber } from '../../services/audio/transcriber';

interface PDFViewerProps {
  document: DocumentEntity;
  onDeleted?: () => void;
  onToggleList?: () => void;
  isListOpen?: boolean;
}

const LARGE_SCREEN_QUERY = '(min-width: 1024px)';
const DEFAULT_PDF_SCALE = 1.2;
const MIN_PDF_SCALE = 0.6;

/** True while the viewport is lg or wider (the assistant docks inline there, and opens as a sheet below). */
function useIsLargeScreen(): boolean {
  const [matches, setMatches] = useState<boolean>(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(LARGE_SCREEN_QUERY).matches
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(LARGE_SCREEN_QUERY);
    const update = () => setMatches(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return matches;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({
  document: docEntity,
  onDeleted,
  onToggleList,
  isListOpen,
}) => {
  const { selectedModel, isConnected, provider } = useAI();
  const { addToast, setActiveView, setActiveNoteId } = useWorkspace();

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(DEFAULT_PDF_SCALE);
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
  const isLargeScreen = useIsLargeScreen();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarWidth, setToolbarWidth] = useState<number>(1200);

  // Measure the toolbar so actions that do not fit move into its overflow menu
  useLayoutEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;
    const update = () => setToolbarWidth(el.clientWidth);
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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

  // Open at fit-to-width when the stage (narrowed by the list and assistant panels) can't show the page at
  // the default 120%; otherwise keep 120%. Zoom stays manual after that.
  useEffect(() => {
    if (!pdfDoc) return;
    let cancelled = false;
    void pdfDoc
      .getPage(1)
      .then((page: any) => {
        const stage = containerRef.current;
        if (cancelled || !stage) return;
        const styles = window.getComputedStyle(stage);
        const available = stage.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
        const pageWidth = page.getViewport({ scale: 1 }).width;
        if (available > 0 && pageWidth * DEFAULT_PDF_SCALE > available) {
          setScale(Math.max(MIN_PDF_SCALE, Math.floor((available / pageWidth) * 20) / 20));
        } else {
          setScale(DEFAULT_PDF_SCALE);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pdfDoc]);

  // Auto-generate AI overview if not already generated. The ref keeps it to one request per document
  // (a second concurrent run, e.g. React StrictMode's effect replay, would interleave two streamed answers).
  const overviewRequestedFor = useRef<string | null>(null);
  useEffect(() => {
    if (docEntity && !aiResponse && !isAiLoading && isConnected && selectedModel && overviewRequestedFor.current !== docEntity.id) {
      overviewRequestedFor.current = docEntity.id;
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
      // design-exception: annotation colors are document content drawn on the page
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
        await ai.streamGenerate(
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

  // The toolbar follows its own width (the list and assistant columns squeeze it): page navigation,
  // compiled notes, the assistant toggle and the overflow menu always show; the rest is added in
  // priority order while it fits, and whatever does not fit moves into the overflow menu.
  const toolbarTiers = (() => {
    const tiers = {
      zoom: false,
      annotate: false,
      aiActions: false,
      notesLabel: false,
      assistantLabel: false,
      docActions: false,
      aiActionLabels: false,
      annotateLabels: false,
    };
    // While the list is open the selected row already names the document, so the title may shrink further
    const titleReserve = isListOpen ? 48 : 120;
    const padding = toolbarWidth >= 640 ? 24 : 16;
    // list toggle, page group, separator, compiled notes (icon + count), assistant toggle, overflow menu, safety margin
    const fixed = padding + (onToggleList ? 32 : 0) + 4 + 102 + 13 + 60 + 32 + 32 + 24;
    let budget = toolbarWidth - fixed - titleReserve;
    const order: Array<[keyof typeof tiers, number]> = [
      ['zoom', 102],
      ['annotate', 109],
      ['aiActions', 77],
      ['notesLabel', 108],
      ['assistantLabel', 88],
      ['docActions', annotations.length > 0 ? 100 : 0],
      ['aiActionLabels', 114],
      ['annotateLabels', 188],
    ];
    for (const [tier, cost] of order) {
      if (budget < cost) break;
      budget -= cost;
      tiers[tier] = true;
    }
    return { ...tiers, titleWidth: budget + titleReserve + 24 };
  })();
  const showZoomInline = toolbarTiers.zoom;
  const showAnnotateInline = toolbarTiers.annotate;
  const showAiActionsInline = toolbarTiers.aiActions;
  const showDocActionsInline = toolbarTiers.docActions;
  const showAnnotateLabels = toolbarTiers.annotateLabels;
  const showAiActionLabels = toolbarTiers.aiActionLabels;
  const showNotesLabel = toolbarTiers.notesLabel;
  const showAssistantLabel = toolbarTiers.assistantLabel;
  const showToolbarTitle = toolbarTiers.titleWidth >= 64;
  const isPresentationDoc =
    docEntity.fileName.toLowerCase().endsWith('.pptx') || docEntity.fileName.toLowerCase().endsWith('.ppt');

  const quickPrompts: Array<{ label: string; prompt: string }> = [
    { label: 'Summarize Page', prompt: 'Summarize this page in 3 concise bullet points.' },
    { label: 'Main Steps', prompt: 'What are the main procedural steps or actions required?' },
    { label: 'Requirements', prompt: 'What are the critical requirements, warnings, or prerequisites?' },
    { label: 'Key Takeaways', prompt: 'What are the 3 most important takeaways from this page?' },
  ];

  const renderAssistant = (inSheet: boolean) => (
    <>
      <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
        <Sparkles className="size-4 text-muted-foreground" />
        {inSheet ? (
          <SheetTitle className="text-sm font-medium">Document Assistant</SheetTitle>
        ) : (
          <h2 className="text-sm font-medium text-foreground">Document Assistant</h2>
        )}
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">Page {currentPage}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setIsAssistantOpen(false)}
          className="text-muted-foreground"
          title="Close assistant panel"
          aria-label="Close assistant panel"
        >
          <PanelRightClose />
        </Button>
      </div>

      {/* Quick question chips with auto-boxout */}
      <div className="shrink-0 space-y-2.5 border-b px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">Quick summaries</span>
          <button
            type="button"
            onClick={() => setAutoBoxoutEnabled(!autoBoxoutEnabled)}
            aria-pressed={autoBoxoutEnabled}
            className="-mr-1 inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors duration-100 hover:bg-accent hover:text-foreground"
            title="Toggle automatic document text box-out and screenshot"
          >
            <StatusDot tone={autoBoxoutEnabled ? 'success' : 'muted'} className="size-1.5" />
            <span>Highlight answers on page: {autoBoxoutEnabled ? 'On' : 'Off'}</span>
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {quickPrompts.map((chip) => (
            <Button
              key={chip.label}
              variant="outline"
              size="xs"
              className="rounded-full px-2.5 font-normal"
              onClick={() => askDocumentAI(chip.prompt)}
            >
              {chip.label}
            </Button>
          ))}
        </div>

        {compiledNotes.length > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsNotesModalOpen(true)}
            className="w-full justify-between"
          >
            <span className="flex items-center gap-1.5">
              <FileText />
              <span>Review Compiled Notes</span>
            </span>
            <Badge variant="outline" className="tabular-nums">
              {compiledNotes.length}
            </Badge>
          </Button>
        )}
      </div>

      {/* Conversation */}
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {aiResponse ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Sparkles className="size-3.5" />
              </span>
              <span className="text-xs font-medium text-muted-foreground">AI Response</span>
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">Sources: p.{currentPage}</span>
            </div>
            <Markdown size="sm" className="pl-8">
              {aiResponse}
            </Markdown>
            <div className="pl-8">
              <Button variant="outline" size="xs" onClick={handleSaveAiAnswerAsNote}>
                <Save />
                <span>Save Analysis as Note</span>
              </Button>
            </div>
          </div>
        ) : isAiLoading ? (
          <div className="flex items-start gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
              <Spinner className="size-3.5" aria-hidden="true" />
            </span>
            <p role="status" className="pt-0.5 text-sm text-muted-foreground animate-pulse motion-reduce:animate-none">
              Reading document chunks and querying {provider === 'ollama' ? 'local Ollama' : PROVIDER_NAMES[provider]}...
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center px-4 py-10 text-center">
            <MessageSquare className="mb-3 size-6 text-muted-foreground/70" strokeWidth={1.5} />
            <p className="text-sm text-foreground">Ask any question about this document or click the chips above.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {PROVIDER_RECIPIENTS[provider]
                ? `Relevant excerpts are sent to ${PROVIDER_RECIPIENTS[provider]} to answer.`
                : 'Answers run on this computer through Ollama.'}
            </p>
          </div>
        )}

        {/* Citations */}
        {aiSources.length > 0 && (
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-muted-foreground">Citations</span>
            {aiSources.map((src, idx) => (
              <button
                type="button"
                key={idx}
                onClick={() => setCurrentPage(src.pageNumber)}
                className="block w-full rounded-md border px-2.5 py-2 text-left transition-colors duration-100 hover:bg-accent"
              >
                <span className="mb-0.5 flex items-center justify-between text-xs">
                  <span className="font-medium tabular-nums text-foreground">Page {src.pageNumber}</span>
                  <span className="text-muted-foreground">Click to navigate</span>
                </span>
                <span className="line-clamp-2 text-xs italic text-muted-foreground">"{src.text}"</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      {/* Docked at the bottom-right of the window: leave room for the companion button when it is shown */}
      <div className="shrink-0 border-t p-3 group-data-[mascot=true]/main:pr-14">
        <div className="flex items-center gap-1 rounded-lg border border-input bg-background py-1 pl-3 pr-1 shadow-xs transition-[color,box-shadow,border-color] duration-100 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/20">
          <input
            type="text"
            placeholder="Ask document question..."
            aria-label="Ask document question"
            value={aiQuestion}
            onChange={(e) => setAiQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isAiLoading) {
                askDocumentAI(aiQuestion);
                setAiQuestion('');
              }
            }}
            disabled={isAiLoading}
            className="h-7 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline-none disabled:opacity-50"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={toggleQuestionDictation}
            aria-pressed={isQuestionDictating}
            className={cn(
              'text-muted-foreground',
              isQuestionDictating && 'bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive'
            )}
            title={isQuestionDictating ? 'Stop speech dictation' : 'Dictate question with mic'}
            aria-label={isQuestionDictating ? 'Stop speech dictation' : 'Dictate question with mic'}
          >
            {isQuestionDictating ? <Mic className="animate-pulse motion-reduce:animate-none" /> : <Mic />}
          </Button>
          <Button
            type="button"
            size="icon-sm"
            className="rounded-full"
            onClick={() => {
              askDocumentAI(aiQuestion);
              setAiQuestion('');
            }}
            disabled={isAiLoading || !aiQuestion.trim()}
            title="Send question"
            aria-label="Send question"
          >
            <ArrowUp />
          </Button>
        </div>
      </div>
    </>
  );

  const hasOverflowItems =
    !showZoomInline || !showAnnotateInline || !showAiActionsInline || !showDocActionsInline;

  return (
    <div className="relative flex h-full min-w-0 flex-1 select-text overflow-hidden bg-background" onMouseUp={handleMouseUp}>
      {/* Center: document stage and toolbar */}
      <div className="flex h-full min-w-0 flex-1 flex-col">
        <Toolbar ref={toolbarRef} className="gap-1 px-2 sm:px-3">
          {onToggleList && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onToggleList}
              className="text-muted-foreground"
              title={isListOpen ? 'Hide document list' : 'Show document list'}
              aria-label={isListOpen ? 'Hide document list' : 'Show document list'}
            >
              {isListOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
            </Button>
          )}

          <span className="min-w-0 flex-1 truncate px-1 text-sm font-medium text-foreground" title={docEntity.title}>
            {showToolbarTitle ? docEntity.title : <span className="sr-only">{docEntity.title}</span>}
          </span>

          <ToolbarGroup className="shrink-0">
            {/* Page group */}
            <div className="inline-flex h-8 items-center rounded-md border px-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-6 text-muted-foreground"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                title="Previous page"
                aria-label="Previous page"
              >
                <ChevronLeft />
              </Button>
              <span className="min-w-12 px-1 text-center text-xs tabular-nums text-foreground">
                {currentPage} / {docEntity.pageCount}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-6 text-muted-foreground"
                disabled={currentPage >= docEntity.pageCount}
                onClick={() => setCurrentPage((p) => Math.min(docEntity.pageCount, p + 1))}
                title="Next page"
                aria-label="Next page"
              >
                <ChevronRight />
              </Button>
            </div>

            {/* Zoom group */}
            {showZoomInline && (
              <div className="inline-flex h-8 items-center rounded-md border px-0.5">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-6 text-muted-foreground"
                  onClick={() => setScale((s) => Math.max(MIN_PDF_SCALE, s - 0.2))}
                  title="Zoom Out"
                  aria-label="Zoom Out"
                >
                  <ZoomOut />
                </Button>
                <span className="min-w-11 px-1 text-center text-xs tabular-nums text-foreground">
                  {Math.round(scale * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-6 text-muted-foreground"
                  onClick={() => setScale((s) => Math.min(2.5, s + 0.2))}
                  title="Zoom In"
                  aria-label="Zoom In"
                >
                  <ZoomIn />
                </Button>
              </div>
            )}

            {/* Manual annotation tools */}
            {showAnnotateInline && (
              <>
                <ToolbarSeparator />
                <Button
                  size={showAnnotateLabels ? 'sm' : 'icon-sm'}
                  variant="ghost"
                  onClick={() => addAnnotationAtCoords('highlight')}
                  title="Add Highlight Box"
                  aria-label={showAnnotateLabels ? undefined : 'Highlight'}
                >
                  <Highlighter />
                  {showAnnotateLabels && <span>Highlight</span>}
                </Button>
                <Button
                  size={showAnnotateLabels ? 'sm' : 'icon-sm'}
                  variant="ghost"
                  onClick={() => addAnnotationAtCoords('rectangle', 'Caution')}
                  title="Add Warning Box"
                  aria-label={showAnnotateLabels ? undefined : 'Box'}
                >
                  <Square />
                  {showAnnotateLabels && <span>Box</span>}
                </Button>
                <Button
                  size={showAnnotateLabels ? 'sm' : 'icon-sm'}
                  variant="ghost"
                  onClick={() => addAnnotationAtCoords('marker')}
                  title="Add Numbered Step Badge"
                  aria-label={showAnnotateLabels ? undefined : 'Step Badge'}
                >
                  <Hash />
                  {showAnnotateLabels && <span>Step Badge</span>}
                </Button>
              </>
            )}

            {/* AI actions */}
            {showAiActionsInline && (
              <>
                <ToolbarSeparator />
                <Button
                  size={showAiActionLabels ? 'sm' : 'icon-sm'}
                  variant="ghost"
                  onClick={() => setIsSuggestionsModalOpen(true)}
                  title="Analyze Page for Suggestions"
                  aria-label={showAiActionLabels ? undefined : 'Callouts'}
                >
                  <Sparkles />
                  {showAiActionLabels && <span>Callouts</span>}
                </Button>
                <Button
                  size={showAiActionLabels ? 'sm' : 'icon-sm'}
                  variant="ghost"
                  onClick={() => setIsStepsModalOpen(true)}
                  title="Transform Section into Numbered Steps"
                  aria-label={showAiActionLabels ? undefined : 'Steps'}
                >
                  <ListOrdered />
                  {showAiActionLabels && <span>Steps</span>}
                </Button>
              </>
            )}

            <ToolbarSeparator />

            {/* Compiled notes */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsNotesModalOpen(true)}
              title="View and download compiled document notes"
              aria-label={showNotesLabel ? undefined : `Compiled Notes (${compiledNotes.length})`}
              className={cn(!showNotesLabel && 'px-2')}
            >
              <FileText />
              {showNotesLabel && <span>Compiled Notes</span>}
              <Badge variant="secondary" className="px-1.5 py-0 tabular-nums">
                {compiledNotes.length}
              </Badge>
            </Button>

            {/* AI Assistant panel toggle */}
            <Button
              size={showAssistantLabel ? 'sm' : 'icon-sm'}
              variant="ghost"
              aria-pressed={isAssistantOpen}
              onClick={() => setIsAssistantOpen((prev) => !prev)}
              title={isAssistantOpen ? 'Hide Assistant Panel' : 'Show Assistant Panel'}
              aria-label={showAssistantLabel ? undefined : 'AI Assistant'}
              className="aria-pressed:bg-accent aria-pressed:text-accent-foreground"
            >
              {isAssistantOpen ? <PanelRightClose /> : <PanelRightOpen />}
              {showAssistantLabel && <span>AI Assistant</span>}
            </Button>

            {/* Document actions: inline when there is room, otherwise in the overflow menu */}
            {showDocActionsInline && (
              <>
                {annotations.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleClearAllAnnotations}
                    title="Clear all annotations on this document"
                    className="text-muted-foreground"
                  >
                    Clear Boxes
                  </Button>
                )}
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => setIsDeleteModalOpen(true)}
                  title="Delete document"
                  aria-label="Delete document"
                  className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 />
                </Button>
              </>
            )}

            {hasOverflowItems && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="text-muted-foreground"
                    title="More document actions"
                    aria-label="More document actions"
                  >
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  {!showZoomInline && (
                    <>
                      <DropdownMenuLabel className="flex items-center justify-between">
                        <span>Zoom</span>
                        <span className="tabular-nums">{Math.round(scale * 100)}%</span>
                      </DropdownMenuLabel>
                      <DropdownMenuItem
                        title="Zoom Out"
                        onSelect={(e) => {
                          e.preventDefault();
                          setScale((s) => Math.max(MIN_PDF_SCALE, s - 0.2));
                        }}
                      >
                        <ZoomOut />
                        <span>Zoom Out</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        title="Zoom In"
                        onSelect={(e) => {
                          e.preventDefault();
                          setScale((s) => Math.min(2.5, s + 0.2));
                        }}
                      >
                        <ZoomIn />
                        <span>Zoom In</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {!showAnnotateInline && (
                    <>
                      <DropdownMenuItem title="Add Highlight Box" onSelect={() => addAnnotationAtCoords('highlight')}>
                        <Highlighter />
                        <span>Highlight</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem title="Add Warning Box" onSelect={() => addAnnotationAtCoords('rectangle', 'Caution')}>
                        <Square />
                        <span>Box</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem title="Add Numbered Step Badge" onSelect={() => addAnnotationAtCoords('marker')}>
                        <Hash />
                        <span>Step Badge</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {!showAiActionsInline && (
                    <>
                      <DropdownMenuItem
                        title="Analyze Page for Suggestions"
                        onSelect={() => setTimeout(() => setIsSuggestionsModalOpen(true), 0)}
                      >
                        <Sparkles />
                        <span>Callouts</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        title="Transform Section into Numbered Steps"
                        onSelect={() => setTimeout(() => setIsStepsModalOpen(true), 0)}
                      >
                        <ListOrdered />
                        <span>Steps</span>
                      </DropdownMenuItem>
                      {!showDocActionsInline && <DropdownMenuSeparator />}
                    </>
                  )}
                  {!showDocActionsInline && (
                    <>
                      {annotations.length > 0 && (
                        <DropdownMenuItem title="Clear all annotations on this document" onSelect={handleClearAllAnnotations}>
                          <Eraser />
                          <span>Clear Boxes</span>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        variant="destructive"
                        title="Delete document"
                        onSelect={() => setTimeout(() => setIsDeleteModalOpen(true), 0)}
                      >
                        <Trash2 />
                        <span>Delete document</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </ToolbarGroup>
        </Toolbar>

        {/* Document stage: canvas for PDFs, a paper sheet for DOCX/PPTX/TXT */}
        <div ref={containerRef} className="flex flex-1 select-text items-start justify-start overflow-auto bg-muted/40 p-4 sm:p-8">
          {isTextDocument ? (
            <div
              ref={textDocRef}
              className="relative mx-auto flex min-h-[720px] w-full max-w-2xl select-text flex-col justify-between rounded-sm bg-paper p-6 text-paper-foreground shadow-lg ring-1 ring-border sm:p-10"
            >
              <div>
                {/* Header */}
                <div className="mb-6 flex items-center justify-between gap-4 border-b border-paper-foreground/15 pb-3 text-xs text-paper-foreground/60">
                  <span className="font-medium tabular-nums">
                    {isPresentationDoc
                      ? `Slide ${currentPage} of ${docEntity.pageCount}`
                      : `Page ${currentPage} of ${docEntity.pageCount}`}
                  </span>
                  <span className="truncate">{docEntity.fileName}</span>
                </div>

                {/* Page content */}
                <div ref={textContentRef} className="select-text space-y-4 whitespace-pre-wrap text-sm leading-relaxed text-paper-foreground">
                  {currentPageText || 'Empty page content.'}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-paper-foreground/15 pt-6 text-xs text-paper-foreground/60">
                <span>Saved on this device</span>
                <span>HuskyNote</span>
              </div>

              <AnnotationLayer annotations={annotations} pageNumber={currentPage} onRemoveAnnotation={handleRemoveAnnotation} />
            </div>
          ) : (
            // Auto margins center the page but, unlike justify-center, never push a zoomed page past the left edge
            <div className="relative mx-auto shrink-0 rounded-sm bg-paper shadow-lg ring-1 ring-border">
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

      {/* Right panel: document assistant (inline at lg+, a sheet on smaller screens) */}
      {isAssistantOpen && isLargeScreen && (
        <section
          aria-label="Document Assistant"
          className="flex h-full w-80 shrink-0 animate-fade-in flex-col border-l bg-background 2xl:w-96"
        >
          {renderAssistant(false)}
        </section>
      )}
      {!isLargeScreen && (
        <Sheet open={isAssistantOpen} onOpenChange={setIsAssistantOpen}>
          <SheetContent side="right" hideClose className="w-full max-w-sm gap-0 p-0 sm:max-w-sm" aria-describedby={undefined}>
            {renderAssistant(true)}
          </SheetContent>
        </Sheet>
      )}

      {/* Floating selection toolbar */}
      {selectionToolbarPos && (
        <div
          style={{
            position: 'fixed',
            left: selectionToolbarPos.x,
            top: selectionToolbarPos.y,
            transform: 'translateX(-50%)',
          }}
          className="z-50 flex animate-fade-in select-none items-center gap-0.5 rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          <Button variant="ghost" size="xs" onClick={() => handleSelectionAction('explain')}>
            Explain
          </Button>
          <Button variant="ghost" size="xs" onClick={() => handleSelectionAction('summarize')}>
            Summarize
          </Button>
          <Button variant="ghost" size="xs" onClick={() => handleSelectionAction('simplify')}>
            Simplify
          </Button>
          <Separator orientation="vertical" className="mx-0.5 h-4" />
          <Button variant="ghost" size="xs" onClick={() => handleSelectionAction('note')}>
            Make Note
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              addAnnotationAtCoords('highlight');
              setSelectionToolbarPos(null);
            }}
          >
            <Highlighter />
            Highlight
          </Button>
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
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{docEntity.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {docEntity.fileName} • {(docEntity.fileSize / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              This will permanently remove the file, extracted pages, and all associated AI annotations and notes from your local storage.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setIsDeleteModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={confirmDeleteDocument}>
                <Trash2 />
                <span>Delete Permanently</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
