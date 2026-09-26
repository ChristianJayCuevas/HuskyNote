import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Note, NoteVersion } from '../../types';
import { db } from '../../db';
import { Button } from '../ui/button';
import { VersionHistoryModal } from './version-history-modal';
import { exportNoteToMarkdown } from '../../services/export/markdown';
import { exportNoteToPdf } from '../../services/export/pdf';
import { downloadJsonFile } from '../../services/export/json';
import { useWorkspace } from '../../context/workspace-context';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';
import {
  Bold,
  Italic,
  Code,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Clock,
  Download,
  Trash2,
  Eye,
  Edit3,
  Columns,
  Tag as TagIcon,
  X,
  ChevronLeft,
  Mic,
  MicOff,
} from 'lucide-react';
import { LiveSpeechTranscriber } from '../../services/audio/transcriber';

interface NoteEditorProps {
  noteId: string;
  onDeleted?: () => void;
  onBackToList?: () => void;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({ noteId, onDeleted, onBackToList }) => {
  const { addToast } = useWorkspace();
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'split'>('edit');
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autosaveTimeoutRef = useRef<any>(null);
  const speechTranscriberRef = useRef<LiveSpeechTranscriber | null>(null);

  // Load note from DB
  useEffect(() => {
    let isMounted = true;
    async function load() {
      const data = await db.notes.get(noteId);
      if (data && isMounted) {
        setNote(data);
        setTitle(data.title);
        setContent(data.content);
        setTags(data.tags || []);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [noteId]);

  // Debounced Autosave to IndexedDB with version snapshotting
  const performSave = useCallback(
    async (newTitle: string, newContent: string, newTags: string[]) => {
      if (!note) return;
      setSaveStatus('saving');

      try {
        const now = Date.now();
        // Create version snapshot if significant changes occur (> 60s since last version)
        let versions = [...note.versions];
        const lastVersion = versions[versions.length - 1];
        if (!lastVersion || now - lastVersion.timestamp > 60000) {
          versions.push({
            id: `v-${now}`,
            timestamp: now,
            title: newTitle,
            content: newContent,
            changeSummary: 'Autosave checkpoint',
          });
          // Cap at 20 versions
          if (versions.length > 20) {
            versions = versions.slice(versions.length - 20);
          }
        }

        await db.notes.update(noteId, {
          title: newTitle,
          content: newContent,
          tags: newTags,
          updatedAt: now,
          versions,
        });

        setNote((prev) =>
          prev
            ? {
                ...prev,
                title: newTitle,
                content: newContent,
                tags: newTags,
                updatedAt: now,
                versions,
              }
            : null
        );

        setSaveStatus('saved');
      } catch (err: any) {
        console.warn('[HuskyNote] Note autosave failed:', err?.message);
        setSaveStatus('saved');
      }
    },
    [note, noteId]
  );

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    autosaveTimeoutRef.current = setTimeout(() => {
      performSave(val, content, tags);
    }, 1200);
  };

  const handleContentChange = (val: string) => {
    setContent(val);
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    autosaveTimeoutRef.current = setTimeout(() => {
      performSave(title, val, tags);
    }, 1200);
  };

  const addTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const cleaned = tagInput.trim().toLowerCase().replace(/^#/, '');
      if (!tags.includes(cleaned)) {
        const nextTags = [...tags, cleaned];
        setTags(nextTags);
        performSave(title, content, nextTags);
      }
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    const nextTags = tags.filter((t) => t !== tagToRemove);
    setTags(nextTags);
    performSave(title, content, nextTags);
  };

  // Voice Dictation effect & listener
  useEffect(() => {
    speechTranscriberRef.current = new LiveSpeechTranscriber();

    const handleGlobalDictation = (e: any) => {
      const text = e.detail?.text;
      if (text) {
        setContent((prev) => {
          const next = prev ? `${prev} ${text}` : text;
          performSave(title, next, tags);
          return next;
        });
      }
    };

    window.addEventListener('huskynote:voice-dictation', handleGlobalDictation);

    return () => {
      speechTranscriberRef.current?.stop();
      window.removeEventListener('huskynote:voice-dictation', handleGlobalDictation);
    };
  }, [title, tags, performSave]);

  // Toggle local voice dictation in note editor
  const toggleDictation = async () => {
    if (isDictating) {
      speechTranscriberRef.current?.stop();
      setIsDictating(false);
      addToast('Voice dictation stopped.', 'info');
    } else {
      try {
        await speechTranscriberRef.current?.start((seg) => {
          setContent((prev) => {
            const next = prev ? `${prev} ${seg.text}` : seg.text;
            performSave(title, next, tags);
            return next;
          });
        });
        setIsDictating(true);
        addToast('Voice dictation active. Speak to dictate into note...', 'success');
      } catch {
        addToast('Could not access microphone for dictation.', 'error');
      }
    }
  };

  // Markdown Formatting Helper
  const insertFormatting = (before: string, after: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end);
    const replacement = `${before}${selected || 'text'}${after}`;
    const nextContent = content.substring(0, start) + replacement + content.substring(end);

    setContent(nextContent);
    performSave(title, nextContent, tags);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + (selected.length || 4));
    }, 0);
  };

  const handleRestoreVersion = (version: NoteVersion) => {
    setTitle(version.title);
    setContent(version.content);
    performSave(version.title, version.content, tags);
    addToast('Note version successfully restored.', 'success');
  };

  const handleDelete = async () => {
    if (confirm('Permanently delete this note?')) {
      await db.notes.delete(noteId);
      addToast('Note deleted.', 'info');
      if (onDeleted) onDeleted();
    }
  };

  const handleExportMarkdown = () => {
    if (!note) return;
    const currentNote: Note = { ...note, title, content, tags };
    const md = exportNoteToMarkdown(currentNote);
    const filename = `${(title || 'untitled').toLowerCase().replace(/\s+/g, '_')}.md`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    addToast('Exported note to Markdown.', 'success');
  };

  const handleExportPdf = () => {
    if (!note) return;
    exportNoteToPdf({ ...note, title, content, tags });
    addToast('Exported note to PDF.', 'success');
  };

  if (!note) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500 text-xs">
        Loading note...
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-black text-slate-900 dark:text-white transition-colors duration-500">
      {/* Editor Header */}
      <div className="border-b border-slate-200 dark:border-zinc-850 px-4 sm:px-8 py-3 flex items-center justify-between gap-3 sm:gap-4 shrink-0 bg-slate-50/70 dark:bg-zinc-950/40">
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          {onBackToList && (
            <button
              onClick={onBackToList}
              className="md:hidden flex items-center gap-1 text-xs text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white px-2 py-1 rounded bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shrink-0"
              title="Back to notes list"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Notes</span>
            </button>
          )}
          <input
            type="text"
            placeholder="Untitled Note"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="w-full bg-transparent text-base sm:text-lg font-bold text-slate-950 dark:text-white placeholder-slate-400 dark:placeholder-zinc-600 focus:outline-none tracking-tight"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-slate-500 dark:text-zinc-500 mr-2 font-mono">
            {saveStatus === 'saving' ? 'Saving...' : 'Saved'}
          </span>

          {/* View mode toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-md p-0.5 mr-2">
            <button
              onClick={() => setViewMode('edit')}
              title="Edit Mode"
              className={`p-1.5 rounded text-xs transition-colors ${
                viewMode === 'edit'
                  ? 'bg-white dark:bg-zinc-800 text-slate-950 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-950 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('split')}
              title="Split View"
              className={`p-1.5 rounded text-xs transition-colors ${
                viewMode === 'split'
                  ? 'bg-white dark:bg-zinc-800 text-slate-950 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-950 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('preview')}
              title="Preview Mode"
              className={`p-1.5 rounded text-xs transition-colors ${
                viewMode === 'preview'
                  ? 'bg-white dark:bg-zinc-800 text-slate-950 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-950 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Voice Dictation Button */}
          <Button
            size="sm"
            variant={isDictating ? 'primary' : 'outline'}
            onClick={toggleDictation}
            title={isDictating ? 'Stop Voice Dictation' : 'Start Voice Dictation'}
            className={isDictating ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse' : ''}
          >
            {isDictating ? <Mic className="w-3.5 h-3.5 text-white" /> : <Mic className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isDictating ? 'Listening...' : 'Dictate'}</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsVersionModalOpen(true)}
            title="Version History"
          >
            <Clock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">History</span>
          </Button>

          <Button size="sm" variant="outline" onClick={handleExportMarkdown} title="Export Markdown">
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">MD</span>
          </Button>

          <Button size="sm" variant="outline" onClick={handleExportPdf} title="Export PDF">
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">PDF</span>
          </Button>

          <Button size="icon" variant="ghost" onClick={handleDelete} title="Delete Note">
            <Trash2 className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400" />
          </Button>
        </div>
      </div>

      {/* Formatting Toolbar */}
      {viewMode !== 'preview' && (
        <div className="border-b border-slate-200 dark:border-zinc-850 px-8 py-1.5 flex items-center gap-1 bg-slate-50/40 dark:bg-zinc-950/20 overflow-x-auto shrink-0">
          <button
            onClick={() => insertFormatting('**', '**')}
            title="Bold"
            className="p-1.5 rounded text-slate-600 hover:text-slate-950 hover:bg-slate-200/70 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-850 transition-colors"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => insertFormatting('*', '*')}
            title="Italic"
            className="p-1.5 rounded text-slate-600 hover:text-slate-950 hover:bg-slate-200/70 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-850 transition-colors"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => insertFormatting('`', '`')}
            title="Inline Code"
            className="p-1.5 rounded text-slate-600 hover:text-slate-950 hover:bg-slate-200/70 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-850 transition-colors"
          >
            <Code className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-slate-200 dark:bg-zinc-800 mx-1" />
          <button
            onClick={() => insertFormatting('# ')}
            title="Heading 1"
            className="p-1.5 rounded text-slate-600 hover:text-slate-950 hover:bg-slate-200/70 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-850 transition-colors"
          >
            <Heading1 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => insertFormatting('## ')}
            title="Heading 2"
            className="p-1.5 rounded text-slate-600 hover:text-slate-950 hover:bg-slate-200/70 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-850 transition-colors"
          >
            <Heading2 className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-slate-200 dark:bg-zinc-800 mx-1" />
          <button
            onClick={() => insertFormatting('- ')}
            title="Bullet List"
            className="p-1.5 rounded text-slate-600 hover:text-slate-950 hover:bg-slate-200/70 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-850 transition-colors"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => insertFormatting('1. ')}
            title="Numbered List"
            className="p-1.5 rounded text-slate-600 hover:text-slate-950 hover:bg-slate-200/70 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-850 transition-colors"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => insertFormatting('- [ ] ')}
            title="Checklist Item"
            className="p-1.5 rounded text-slate-600 hover:text-slate-950 hover:bg-slate-200/70 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-850 transition-colors"
          >
            <CheckSquare className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => insertFormatting('> ')}
            title="Blockquote"
            className="p-1.5 rounded text-slate-600 hover:text-slate-950 hover:bg-slate-200/70 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-850 transition-colors"
          >
            <Quote className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Editor Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Write Pane */}
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div className="flex-1 h-full p-8 overflow-y-auto">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="Write your note in Markdown..."
              className="w-full h-full bg-transparent resize-none text-slate-900 dark:text-zinc-200 text-sm leading-relaxed focus:outline-none font-mono placeholder-slate-400 dark:placeholder-zinc-600"
            />
          </div>
        )}

        {/* Markdown Rendered Preview Pane */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div
            className={`flex-1 h-full p-8 overflow-y-auto ${
              viewMode === 'split' ? 'border-l border-slate-200 dark:border-zinc-850 bg-slate-50/40 dark:bg-zinc-950/20' : ''
            }`}
          >
            <div className="prose prose-slate dark:prose-invert max-w-none text-sm leading-relaxed text-slate-900 dark:text-zinc-100">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {DOMPurify.sanitize(content || '*No content*')}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      {/* Tags Footer */}
      <div className="border-t border-slate-200 dark:border-zinc-850 px-8 py-2.5 flex items-center gap-2 bg-slate-50/60 dark:bg-zinc-950/40 text-xs">
        <TagIcon className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
        <div className="flex items-center gap-1.5 flex-wrap">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-300 text-[11px]"
            >
              #{tag}
              <button
                onClick={() => removeTag(tag)}
                className="text-slate-400 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-200"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
          <input
            type="text"
            placeholder="Add tag and press Enter..."
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={addTag}
            className="bg-transparent text-xs text-slate-900 dark:text-zinc-300 placeholder-slate-400 dark:placeholder-zinc-600 focus:outline-none min-w-[140px]"
          />
        </div>
      </div>

      {/* Version History Modal */}
      {isVersionModalOpen && (
        <VersionHistoryModal
          isOpen={isVersionModalOpen}
          onClose={() => setIsVersionModalOpen(false)}
          note={note}
          onRestore={handleRestoreVersion}
        />
      )}
    </div>
  );
};
