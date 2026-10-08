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
import { ListPane, ListPaneBody, ListPaneEmpty, ListPaneHeader, ListItem } from '../components/ui/list-pane';
import { cn } from '../lib/utils';
import { FileUp, File, Plus, UploadCloud, FileText, Presentation, PanelLeftClose, Trash2 } from 'lucide-react';

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
    const handleUploadTrigger = () => {
      const current = new URL(window.location.href);
      current.searchParams.delete('action');
      window.history.replaceState(window.history.state, '', current.toString());
      fileInputRef.current?.click();
    };
    const url = new URL(window.location.href);
    if (url.searchParams.get('action') === 'upload') {
      url.searchParams.delete('action');
      window.history.replaceState(window.history.state, '', url.toString());
      fileInputRef.current?.click();
    }
    window.addEventListener('huskynote:upload-pdf', handleUploadTrigger);
    return () => window.removeEventListener('huskynote:upload-pdf', handleUploadTrigger);
  }, []);

  const selectedDocument = documents.find((d) => d.id === activeDocumentId);

  const getDocIcon = (fileName: string) => {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.pptx') || lower.endsWith('.ppt')) {
      return <Presentation className="size-4 shrink-0 text-muted-foreground" />;
    }
    if (lower.endsWith('.docx') || lower.endsWith('.doc') || lower.endsWith('.txt') || lower.endsWith('.md')) {
      return <FileText className="size-4 shrink-0 text-muted-foreground" />;
    }
    return <File className="size-4 shrink-0 text-muted-foreground" />;
  };

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-background">
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

      {/* Left column: document list (full width on phones, where it replaces the viewer while open) */}
      {isListOpen && (
        <div className="z-10 h-full w-full shrink-0 animate-fade-in md:w-72">
          <ListPane>
            <ListPaneHeader
              title="Documents"
              count={documents.length}
              actions={
                <>
                  <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                    <Plus />
                    <span>Upload</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setIsListOpen(false)}
                    // On md+ the viewer toolbar's list toggle does this; phones need it to get back to the viewer
                    className="text-muted-foreground md:hidden"
                    title="Collapse document list"
                    aria-label="Collapse document list"
                  >
                    <PanelLeftClose />
                  </Button>
                </>
              }
            />

            <ListPaneBody>
              {documents.length === 0 ? (
                <ListPaneEmpty
                  icon={<FileText />}
                  title="No documents uploaded yet."
                  description="Upload a PDF, Word (DOCX), PowerPoint (PPTX), or text file to analyze with local AI."
                />
              ) : (
                documents.map((d) => {
                  const isSelected = activeDocumentId === d.id;
                  const isPresentation = d.fileName.toLowerCase().endsWith('.pptx') || d.fileName.toLowerCase().endsWith('.ppt');
                  return (
                    <ListItem
                      key={d.id}
                      selected={isSelected}
                      leading={getDocIcon(d.fileName)}
                      title={d.title}
                      meta={
                        <span className="tabular-nums">
                          {d.pageCount} {isPresentation ? 'slides' : 'pages'} · {(d.fileSize / 1024 / 1024).toFixed(2)} MB
                        </span>
                      }
                      onClick={() => {
                        setActiveDocumentId(d.id);
                        if (typeof window !== 'undefined' && window.innerWidth < 768) {
                          setIsListOpen(false);
                        }
                      }}
                      actions={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDocToDelete(d);
                          }}
                          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title={`Delete "${d.title}"`}
                          aria-label={`Delete "${d.title}"`}
                        >
                          <Trash2 />
                        </Button>
                      }
                    />
                  );
                })
              )}
            </ListPaneBody>
          </ListPane>
        </div>
      )}

      {/* Right area: document viewer or upload dropzone */}
      <div className={cn('h-full min-w-0 flex-1 flex-col', isListOpen ? 'hidden md:flex' : 'flex')}>
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
            className="flex flex-1 items-center justify-center p-4 sm:p-8"
          >
            <div className="w-full max-w-lg rounded-xl border-2 border-dashed border-border bg-muted/30 transition-colors duration-100 hover:bg-muted/50">
              <EmptyState
                icon={UploadCloud}
                title="Upload Any Document"
                description="Drag and drop your PDF, Word (.docx), PowerPoint (.pptx), Markdown (.md), or plain text (.txt) file here. Parsed 100% locally with instant AI analysis."
                className="py-12"
              >
                <Button className="mt-6" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                  <FileUp />
                  <span>{isUploading ? 'Extracting Text...' : 'Select Document'}</span>
                </Button>
              </EmptyState>
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
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
              {getDocIcon(docToDelete.fileName)}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{docToDelete.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {docToDelete.fileName} • {(docToDelete.fileSize / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              This will permanently remove the file, extracted pages, and all associated AI annotations and compiled notes from your browser's local database.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setDocToDelete(null)}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={handleConfirmDeleteDoc}>
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
