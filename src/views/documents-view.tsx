import React, { useState, useEffect, useRef } from 'react';
import { useWorkspace } from '../context/workspace-context';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { DocumentEntity } from '../types';
import { PDFViewer } from '../components/documents/pdf-viewer';
import { parseDocumentFile } from '../services/documents/universal-parser';
import { EmptyState } from '../components/ui/empty-state';
import { Button } from '../components/ui/button';
import { Modal } from '../components/ui/modal';
import {
  FileUp,
  File,
  Plus,
  UploadCloud,
  AlertCircle,
  FileText,
  Presentation,
  PanelLeftClose,
  PanelLeftOpen,
  Trash2,
} from 'lucide-react';

export const DocumentsView: React.FC = () => {
  const { activeDocumentId, setActiveDocumentId, addToast } = useWorkspace();
  const [isUploading, setIsUploading] = useState(false);
  const [docToDelete, setDocToDelete] = useState<DocumentEntity | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isListOpen, setIsListOpen] = useState<boolean>(() => {
    return typeof window !== 'undefined' && window.innerWidth >= 1024;
  });

  const documents = useLiveQuery(() => db.documents.orderBy('createdAt').reverse().toArray(), []) || [];

  // Auto-select valid document or clear active ID if current is deleted
  useEffect(() => {
    if (documents.length > 0) {
      if (!activeDocumentId || !documents.some((d) => d.id === activeDocumentId)) {
        setActiveDocumentId(documents[0].id);
      }
    } else if (activeDocumentId) {
      setActiveDocumentId(null);
    }
  }, [documents, activeDocumentId, setActiveDocumentId]);

  // Handle document deletion safely
  const handleConfirmDeleteDoc = async () => {
    if (!docToDelete) return;
    const deletingId = docToDelete.id;
    const deletingTitle = docToDelete.title;
    const blobId = docToDelete.fileBlobId;

    try {
      await db.documents.delete(deletingId);
      if (blobId) {
        await db.blobs.delete(blobId);
      }
      await db.annotations.where('documentId').equals(deletingId).delete();
      addToast(`Deleted "${deletingTitle}".`, 'info');

      if (activeDocumentId === deletingId) {
        const remaining = documents.filter((d) => d.id !== deletingId);
        setActiveDocumentId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err: any) {
      console.error('[HuskyNote] Failed to delete document:', err);
      addToast(`Failed to delete document: ${err?.message || 'Unknown error'}`, 'error');
    } finally {
      setDocToDelete(null);
    }
  };

  // Handle universal file upload (PDF, PPT, DOCX, TXT, MD)
  const processUploadedFile = async (file: File) => {
    const name = file.name.toLowerCase();
    const isSupported =
      name.endsWith('.pdf') ||
      name.endsWith('.docx') ||
      name.endsWith('.doc') ||
      name.endsWith('.pptx') ||
      name.endsWith('.ppt') ||
      name.endsWith('.txt') ||
      name.endsWith('.text') ||
      name.endsWith('.md') ||
      name.endsWith('.markdown') ||
      file.type.startsWith('text/');

    if (!isSupported) {
      addToast('Supported formats: PDF, DOCX, PPTX, TXT, and Markdown.', 'error');
      return;
    }

    if (file.size > 80 * 1024 * 1024) {
      addToast('File exceeds 80MB limit for local in-browser processing.', 'error');
      return;
    }

    setIsUploading(true);
    addToast(`Extracting text and pages from "${file.name}"...`, 'info');

    try {
      const result = await parseDocumentFile(file);

      const mimeType = name.endsWith('.pdf')
        ? 'application/pdf'
        : name.endsWith('.docx')
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : name.endsWith('.pptx')
        ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        : 'text/plain';

      const blobId = `blob-${result.fileType}-${Date.now()}`;
      await db.blobs.put({
        id: blobId,
        data: file,
        mimeType,
        fileName: file.name,
        createdAt: Date.now(),
      });

      const docId = `doc-${Date.now()}`;
      await db.documents.put({
        id: docId,
        title: file.name.replace(/\.[^/.]+$/, ''),
        fileName: file.name,
        fileSize: file.size,
        pageCount: result.pageCount,
        fileBlobId: blobId,
        extractedPages: result.extractedPages,
        createdAt: Date.now(),
      });

      setActiveDocumentId(docId);
      const unit = result.fileType === 'pptx' || result.fileType === 'ppt' ? 'slides' : 'pages';
      addToast(`Parsed "${file.name}" (${result.pageCount} ${unit}). AI summary ready!`, 'success');
    } catch (err: any) {
      console.error('[HuskyNote] Document upload failed:', err);
      addToast(`Failed to parse file: ${err?.message || 'Invalid format'}`, 'error');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Listen to Topbar trigger
  useEffect(() => {
    const handleUploadTrigger = () => fileInputRef.current?.click();
    window.addEventListener('huskynote:upload-pdf', handleUploadTrigger);
    return () => window.removeEventListener('huskynote:upload-pdf', handleUploadTrigger);
  }, []);

  const selectedDocument = documents.find((d) => d.id === activeDocumentId);

  const getDocIcon = (fileName: string) => {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.pptx') || lower.endsWith('.ppt')) {
      return <Presentation className="w-4 h-4 text-zinc-300 shrink-0" />;
    }
    if (lower.endsWith('.docx') || lower.endsWith('.doc') || lower.endsWith('.txt') || lower.endsWith('.md')) {
      return <FileText className="w-4 h-4 text-zinc-300 shrink-0" />;
    }
    return <File className="w-4 h-4 text-zinc-400 shrink-0" />;
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-50 dark:bg-canvas transition-colors duration-500 font-sans">
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) processUploadedFile(file);
        }}
        accept=".pdf,.docx,.doc,.pptx,.ppt,.txt,.md,text/plain,application/pdf"
        className="hidden"
      />

      {/* Left Sidebar: Document List */}
      {isListOpen && (
        <div className="w-72 lg:w-80 border-r border-slate-200 dark:border-zinc-850 flex flex-col h-full bg-white dark:bg-zinc-950 shrink-0 select-none animate-fade-in z-10 transition-colors duration-500">
          <div className="p-3.5 border-b border-slate-200 dark:border-zinc-850 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-zinc-300 uppercase tracking-wider">
              Documents ({documents.length})
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Upload</span>
              </Button>
              <button
                onClick={() => setIsListOpen(false)}
                className="p-1 rounded text-slate-500 dark:text-zinc-500 hover:text-slate-950 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors"
                title="Collapse document list"
                aria-label="Collapse document list"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-850">
            {documents.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-zinc-500">
                No documents uploaded yet. Upload a PDF, Word (DOCX), PowerPoint (PPTX), or text file to analyze with local AI.
              </div>
            ) : (
              documents.map((d) => {
                const isSelected = activeDocumentId === d.id;
                const isPresentation = d.fileName.toLowerCase().endsWith('.pptx') || d.fileName.toLowerCase().endsWith('.ppt');
                return (
                  <div
                    key={d.id}
                    onClick={() => {
                      setActiveDocumentId(d.id);
                      if (typeof window !== 'undefined' && window.innerWidth < 768) {
                        setIsListOpen(false);
                      }
                    }}
                    className={`p-3.5 cursor-pointer transition-colors group relative ${
                      isSelected
                        ? 'bg-slate-100 dark:bg-zinc-900/90 text-slate-950 dark:text-white border-l-2 border-slate-900 dark:border-white'
                        : 'hover:bg-slate-50 dark:hover:bg-zinc-900/40 text-slate-700 dark:text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {getDocIcon(d.fileName)}
                        <h4 className="text-xs font-bold text-slate-950 dark:text-zinc-100 truncate">{d.title}</h4>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDocToDelete(d);
                        }}
                        className="p-1 rounded text-slate-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors opacity-70 group-hover:opacity-100 shrink-0"
                        title={`Delete "${d.title}"`}
                        aria-label={`Delete "${d.title}"`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 dark:text-zinc-500 pl-6 font-medium">
                      <span>
                        {d.pageCount} {isPresentation ? 'slides' : 'pages'}
                      </span>
                      <span>•</span>
                      <span>{(d.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Right Area: Document Viewer or Upload Dropzone */}
      <div className="flex-1 h-full min-w-0 flex flex-col">
        {selectedDocument ? (
          <PDFViewer
            document={selectedDocument}
            onToggleList={() => setIsListOpen((prev) => !prev)}
            isListOpen={isListOpen}
            onDeleted={() => {
              const remaining = documents.filter((d) => d.id !== selectedDocument.id);
              setActiveDocumentId(remaining.length > 0 ? remaining[0].id : null);
            }}
          />
        ) : (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) processUploadedFile(file);
            }}
            className="flex-1 flex items-center justify-center p-8"
          >
            <div className="max-w-md w-full border-2 border-dashed dark:border-zinc-850 rounded-2xl p-12 text-center bg-zinc-950/40 flex flex-col items-center shadow-2xl">
              <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 mb-4">
                <UploadCloud className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-100 mb-1">Upload Any Document</h3>
              <p className="text-xs text-zinc-400 leading-relaxed mb-6">
                Drag and drop your PDF, Word (.docx), PowerPoint (.pptx), Markdown (.md), or plain text (.txt) file here.
                Parsed 100% locally with instant AI analysis.
              </p>
              <Button
                variant="primary"
                size="md"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                <FileUp className="w-4 h-4" />
                <span>{isUploading ? 'Extracting Text...' : 'Select Document'}</span>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {docToDelete && (
        <Modal
          isOpen={true}
          onClose={() => setDocToDelete(null)}
          title="Delete Document"
          description="Are you sure you want to delete this document? This action cannot be undone."
          maxWidth="sm"
        >
          <div className="p-6 space-y-4">
            <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center gap-3">
              {getDocIcon(docToDelete.fileName)}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-zinc-100 truncate">{docToDelete.title}</p>
                <p className="text-[10px] font-mono text-zinc-400">
                  {docToDelete.fileName} • {(docToDelete.fileSize / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              This will permanently remove the file, extracted pages, and all associated AI annotations and compiled notes from your browser's local database.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDocToDelete(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmDeleteDoc}
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
