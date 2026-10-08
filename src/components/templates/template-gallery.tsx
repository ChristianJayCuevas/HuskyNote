import React, { useState } from 'react';
import type { Template } from '../../types';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useWorkspace } from '../../context/workspace-context';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { Field } from '../ui/field';
import { Input } from '../ui/input';
import { Modal } from '../ui/modal';
import { NativeSelect } from '../ui/native-select';
import { PageContainer, PageHeader } from '../ui/page';
import { Textarea } from '../ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { Plus, FileText } from 'lucide-react';

/** Plain-text preview of markdown: strips syntax, keeps line breaks. */
function templateExcerpt(md: string): string {
  return (md || '')
    .replace(/```[\s\S]*?```/g, '')
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^\s{0,3}#{1,6}\s+/, '')
        .replace(/^\s*>\s?/, '')
        .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/, '- ')
        .replace(/^(\s*)[*+]\s+/, '$1- ')
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/(\*\*|__|\*|_|`|~~)/g, '')
        .replace(/^\s*\|?[-:| ]{3,}\|?\s*$/, '')
        .replace(/\|/g, ' ')
        .trimEnd()
    )
    .filter((l, idx, arr) => l !== '' || (idx > 0 && arr[idx - 1] !== ''))
    .join('\n')
    .trim()
    .slice(0, 400);
}

export const TemplateGallery: React.FC = () => {
  const { setActiveView, setActiveNoteId, addToast } = useWorkspace();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'meeting' | 'document' | 'operation' | 'general'>('general');
  const [newContent, setNewContent] = useState('');

  const templates = useLiveQuery(() => db.templates.toArray(), []) || [];

  const filtered = templates.filter(
    (t) => selectedCategory === 'all' || t.category === selectedCategory
  );

  const handleUseTemplate = async (tmpl: Template) => {
    try {
      const noteId = `note-${Date.now()}`;
      await db.notes.put({
        id: noteId,
        title: `${tmpl.title} - ${new Date().toLocaleDateString()}`,
        content: tmpl.defaultContent,
        tags: [tmpl.category, 'template'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        versions: [],
      });
      addToast(`Created new note from template "${tmpl.title}".`, 'success');
      setActiveNoteId(noteId);
      setActiveView('notes');
    } catch {
      addToast('Failed to create note from template.', 'error');
    }
  };

  const handleCreateCustom = async () => {
    if (!newTitle.trim()) return;
    try {
      const id = `custom-${Date.now()}`;
      await db.templates.put({
        id,
        title: newTitle.trim(),
        category: newCategory,
        description: 'User-created custom workspace template',
        defaultContent: newContent || '# ' + newTitle + '\n\n',
        isBuiltin: false,
      });
      addToast('Custom template created.', 'success');
      setIsCustomModalOpen(false);
      setNewTitle('');
      setNewContent('');
    } catch {
      addToast('Failed to create template.', 'error');
    }
  };

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Templates Gallery"
        description="Standard structures for meeting notes, project briefs, SOPs, and engineering logs."
        actions={
          <Button size="sm" variant="default" onClick={() => setIsCustomModalOpen(true)}>
            <Plus />
            <span>Create Custom Template</span>
          </Button>
        }
      >
        {/* Categories */}
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={selectedCategory}
          onValueChange={(value) => value && setSelectedCategory(value)}
          aria-label="Template category"
        >
          {['all', 'meeting', 'operation', 'general'].map((cat) => (
            <ToggleGroupItem key={cat} value={cat} className="px-3 capitalize">
              {cat}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </PageHeader>

      {/* Grid of templates */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((tmpl) => (
          <Card key={tmpl.id} className="flex flex-col p-4 transition-colors duration-100 hover:bg-accent/40">
            <div className="flex items-start gap-2.5">
              <FileText className="mt-0.5 size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-medium leading-6 text-foreground">{tmpl.title}</h2>
                  <Badge variant="secondary" className="mt-0.5 capitalize">{tmpl.category}</Badge>
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{tmpl.description}</p>
              </div>
            </div>
            <div className="mt-3 flex-1 rounded-md bg-muted p-3">
              <div className="line-clamp-5 whitespace-pre-line text-xs leading-5 text-muted-foreground">
                {templateExcerpt(tmpl.defaultContent)}
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => handleUseTemplate(tmpl)} className="-ml-2 mt-2 self-start">
              <FileText />
              <span>Use This Template</span>
            </Button>
          </Card>
        ))}
      </div>

      {/* Create custom template */}
      <Modal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        title="New Workspace Template"
        description="Design a reusable structure for your notes and operations"
        maxWidth="lg"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void handleCreateCustom();
          }}
        >
          <Field label="Template Title" htmlFor="template-title">
            <Input
              id="template-title"
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g., Weekly Incident Retrospective"
              data-dialog-autofocus
            />
          </Field>

          <Field label="Category" htmlFor="template-category">
            <NativeSelect
              id="template-category"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as typeof newCategory)}
            >
              <option value="general">General</option>
              <option value="meeting">Meeting</option>
              <option value="operation">Operation</option>
            </NativeSelect>
          </Field>

          <Field label="Default Markdown Content" htmlFor="template-content">
            <Textarea
              id="template-content"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={6}
              placeholder={'# Heading\n\n- [ ] Task 1...'}
              className="font-mono text-xs"
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setIsCustomModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="default">
              Save Template
            </Button>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
};
