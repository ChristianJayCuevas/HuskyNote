import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import type { Note, NoteVersion } from '../../types';
import { db } from '../../db';
import { Button } from '../ui/button';
import { Alert } from '../ui/alert';
import { Markdown } from '../ui/markdown';
import { StatusDot } from '../ui/status-dot';
import { SimpleTooltip } from '../ui/tooltip';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { Toolbar, ToolbarGroup, ToolbarSeparator } from '../ui/toolbar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { VersionHistoryModal } from './version-history-modal';
import { autoGrowTextarea } from './auto-grow-textarea';
import { exportNoteToMarkdown } from '../../services/export/markdown';
import { exportNoteToPdf } from '../../services/export/pdf';
import { useWorkspace } from '../../context/workspace-context';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
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
  FileDown,
  Trash2,
  Eye,
  Edit3,
  Columns,
  Tag as TagIcon,
  X,
  ChevronLeft,
  Maximize2,
  Mic,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { LiveSpeechTranscriber } from '../../services/audio/transcriber';
import { useNoteDraft } from './use-note-draft';

type FormatAction = { label: string; icon: LucideIcon; before: string; after?: string };

/** Markdown formatting buttons, grouped (a separator sits between groups) */
const FORMAT_GROUPS: FormatAction[][] = [
  [
    { label: 'Bold', icon: Bold, before: '**', after: '**' },
    { label: 'Italic', icon: Italic, before: '*', after: '*' },
    { label: 'Inline Code', icon: Code, before: '`', after: '`' },
  ],
  [
    { label: 'Heading 1', icon: Heading1, before: '# ' },
    { label: 'Heading 2', icon: Heading2, before: '## ' },
  ],
  [
    { label: 'Bullet List', icon: List, before: '- ' },
    { label: 'Numbered List', icon: ListOrdered, before: '1. ' },
    { label: 'Checklist Item', icon: CheckSquare, before: '- [ ] ' },
    { label: 'Blockquote', icon: Quote, before: '> ' },
  ],
];

interface NoteEditorProps {
  noteId: string;
  onDeleted?: () => void;
  onBackToList?: () => void;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({ noteId, onDeleted, onBackToList }) => {
  const { addToast, setActiveView, setActiveNoteId } = useWorkspace();
  const onSaveError = useCallback(() => addToast('A note could not be saved. Reopen it to retry or export your draft before closing the app.', 'error'), [addToast]);
  const { note, title, content, tags, saveStatus, saveError, setTitle, setContent, setTags, performSave, retry, discard, resume } = useNoteDraft(noteId, onSaveError);
  const [tagInput, setTagInput] = useState('');
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'split'>('edit');
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const speechTranscriberRef = useRef<LiveSpeechTranscriber | null>(null);

  // The note body grows with its content so the whole page scrolls like a document
  useLayoutEffect(() => {
    autoGrowTextarea(textareaRef.current);
  }, [content, viewMode, note]);
  useEffect(() => {
    const onResize = () => autoGrowTextarea(textareaRef.current);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleTitleChange = (val: string) => setTitle(val);
  const handleContentChange = (val: string) => setContent(val);

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

  const handleRestoreVersion = async (version: NoteVersion) => {
    setTitle(version.title);
    setContent(version.content);
    if (await performSave(version.title, version.content, tags)) addToast('Note version successfully restored.', 'success');
  };

  const handleDelete = async () => {
    if (!note) return;
    if (confirm('Delete this note? You can undo while the app stays open.')) {
      const deletedNote = { ...note, title, content, tags: [...tags] };
      await discard();
      try { await db.notes.delete(noteId); }
      catch { resume(); addToast('Could not delete the note. Your draft is still here.', 'error'); return; }
      let restoring = false;
      let restored = false;
      addToast('Note deleted. Undo is available until this message is dismissed.', 'info', {
        label: 'Undo deletion',
        run: async () => {
          if (restoring || restored) return;
          restoring = true;
          try {
            await db.notes.add(deletedNote);
            restored = true;
            setActiveNoteId(noteId);
            setActiveView('notes');
            addToast('Note restored.', 'success');
          } catch (error) {
            addToast('Could not restore the note. Keep this message open and retry.', 'error');
            throw error;
          } finally { restoring = false; }
        },
      });
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
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Loading note...
      </div>
    );
  }

  const saveLabel =
    saveStatus === 'saving' ? 'Saving...' : saveStatus === 'unsaved' ? 'Unsaved changes' : saveStatus === 'error' ? 'Couldn’t save' : 'Saved on this device';

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-background text-foreground">
      {/* Editor Header */}
      <Toolbar className="gap-1 px-2 sm:px-4">
        {onBackToList && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onBackToList}
            className="shrink-0 text-muted-foreground md:hidden"
            title="Back to notes list"
          >
            <ChevronLeft />
            <span>Notes</span>
          </Button>
        )}

        <span
          role="status"
          className={cn('min-w-0 truncate px-1 text-xs', saveStatus === 'error' ? 'text-destructive' : 'text-muted-foreground')}
        >
          {saveLabel}
        </span>

        <ToolbarGroup className="ml-auto shrink-0">
          {/* View mode toggle */}
          <ToggleGroup
            type="single"
            size="sm"
            value={viewMode}
            onValueChange={(value) => value && setViewMode(value as typeof viewMode)}
            aria-label="Editor view"
          >
            <ToggleGroupItem value="edit" title="Edit Mode" aria-label="Edit note">
              <Edit3 />
            </ToggleGroupItem>
            <ToggleGroupItem value="split" title="Split View" aria-label="Split editor and preview">
              <Columns />
            </ToggleGroupItem>
            <ToggleGroupItem value="preview" title="Preview Mode" aria-label="Preview note">
              <Eye />
            </ToggleGroupItem>
          </ToggleGroup>

          <ToolbarSeparator className="hidden sm:block" />

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setActiveView('zen')}
            title="Focus mode: distraction-free writing"
            aria-label="Focus mode"
            className="text-muted-foreground max-sm:w-7 max-sm:px-0"
          >
            <Maximize2 />
            <span className="hidden sm:inline">Focus</span>
          </Button>

          {/* Voice Dictation Button */}
          <Button
            size="sm"
            variant="ghost"
            onClick={toggleDictation}
            title={isDictating ? 'Stop Voice Dictation' : 'Start Voice Dictation'}
            aria-label={isDictating ? 'Stop dictation' : 'Dictate note'}
            aria-pressed={isDictating}
            className={cn(
              'max-sm:w-7 max-sm:px-0',
              isDictating
                ? 'bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive'
                : 'text-muted-foreground'
            )}
          >
            {isDictating ? <StatusDot tone="destructive" pulse /> : <Mic />}
            <span className="hidden sm:inline">{isDictating ? 'Listening...' : 'Dictate'}</span>
          </Button>

          <DropdownMenu>
            <SimpleTooltip content="Note actions" side="bottom">
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Note actions" className="text-muted-foreground">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
            </SimpleTooltip>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem title="Version History" onSelect={() => setTimeout(() => setIsVersionModalOpen(true), 0)}>
                <Clock />
                Version history
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleExportMarkdown}>
                <Download />
                Export Markdown
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleExportPdf}>
                <FileDown />
                Export PDF
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setTimeout(() => void handleDelete(), 0)}>
                <Trash2 />
                Delete note…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ToolbarGroup>
      </Toolbar>

      {saveStatus === 'error' && (
        <div className={cn('mx-auto w-full shrink-0 px-4 pt-3 sm:px-6 lg:px-12', viewMode === 'split' ? 'max-w-6xl' : 'max-w-3xl')}>
          <Alert variant="destructive" role="alert" className="items-center py-2">
            <AlertCircle />
            <div className="col-start-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
              <span className="min-w-0">{saveError}</span>
              <Button size="xs" variant="outline" onClick={() => void retry()}>
                Retry save
              </Button>
            </div>
          </Alert>
        </div>
      )}

      {/* Editor Body: one document column that scrolls as a page */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={cn('mx-auto w-full px-4 pb-24 pt-8 sm:px-6 lg:px-12', viewMode === 'split' ? 'max-w-6xl' : 'max-w-3xl')}>
          <input
            type="text"
            placeholder="Untitled Note"
            aria-label="Note title"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="w-full bg-transparent text-3xl font-bold leading-tight tracking-tight text-foreground outline-none placeholder:text-muted-foreground/50 focus-visible:outline-none sm:text-4xl"
          />

          {/* Properties: tags */}
          <div className="mt-4 flex items-start gap-2 border-b pb-3 text-sm">
            <div className="flex h-7 w-20 shrink-0 items-center gap-1.5 text-muted-foreground sm:w-28">
              <TagIcon className="size-4" />
              <span>Tags</span>
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex h-6 items-center gap-0.5 rounded-md bg-secondary pl-2 pr-0.5 text-xs text-secondary-foreground"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    aria-label={`Remove tag ${tag}`}
                    className="inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground transition-colors duration-100 hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              <input
                type="text"
                placeholder="Add tag and press Enter..."
                aria-label="Add tag"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={addTag}
                className="h-7 min-w-[140px] flex-1 rounded-md bg-transparent px-1.5 text-sm text-foreground outline-none transition-colors duration-100 placeholder:text-muted-foreground/70 hover:bg-accent focus:bg-transparent focus-visible:outline-none"
              />
            </div>
          </div>

          {/* Formatting Toolbar */}
          {viewMode !== 'preview' && (
            <div
              role="toolbar"
              aria-label="Formatting"
              className="sticky top-0 z-10 -mx-1 flex items-center gap-0.5 bg-background py-1.5"
            >
              {FORMAT_GROUPS.map((group, groupIndex) => (
                <React.Fragment key={groupIndex}>
                  {groupIndex > 0 && <ToolbarSeparator className="mx-1 h-4" />}
                  {group.map(({ label, icon: Icon, before, after }) => (
                    <SimpleTooltip key={label} content={label}>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={label}
                        onClick={() => insertFormatting(before, after)}
                        className="text-muted-foreground"
                      >
                        <Icon />
                      </Button>
                    </SimpleTooltip>
                  ))}
                </React.Fragment>
              ))}
            </div>
          )}

          <div className={cn(viewMode === 'preview' ? 'pt-6' : 'pt-3', viewMode === 'split' && 'grid gap-8 md:grid-cols-2')}>
            {/* Write Pane */}
            {(viewMode === 'edit' || viewMode === 'split') && (
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Write your note in Markdown..."
                aria-label="Note content"
                className="block min-h-[50vh] w-full resize-none overflow-hidden bg-transparent font-sans text-base leading-7 text-foreground outline-none placeholder:text-muted-foreground/70 focus-visible:outline-none"
              />
            )}

            {/* Markdown Rendered Preview Pane */}
            {(viewMode === 'preview' || viewMode === 'split') && (
              <div className={cn('min-w-0', viewMode === 'split' && 'border-t pt-6 md:border-l md:border-t-0 md:pl-8 md:pt-0')}>
                <Markdown>{content || '*No content*'}</Markdown>
              </div>
            )}
          </div>
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
