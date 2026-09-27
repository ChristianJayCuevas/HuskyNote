import React, { useState } from 'react';
import type { Template } from '../../types';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useWorkspace } from '../../context/workspace-context';
import { Button } from '../ui/button';
import { Modal } from '../ui/modal';
import { BookOpen, Plus, FileText, Check } from 'lucide-react';

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
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-black p-8 overflow-y-auto max-w-5xl mx-auto w-full select-none">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b dark:border-zinc-850 pb-5 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-950 dark:text-white tracking-tight">Templates Gallery</h2>
          <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">
            Standard structures for meeting notes, project briefs, SOPs, and engineering logs.
          </p>
        </div>

        <Button size="sm" variant="primary" onClick={() => setIsCustomModalOpen(true)}>
          <Plus className="w-3.5 h-3.5" />
          <span>Create Custom Template</span>
        </Button>
      </div>

      {/* Categories */}
      <div className="flex items-center gap-2 mb-6">
        {['all', 'meeting', 'operation', 'general'].map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              selectedCategory === cat
                ? 'bg-slate-100 dark:bg-zinc-800 text-slate-950 dark:text-white'
                : 'bg-slate-50/50 dark:bg-zinc-900/50 text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-900'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid of Templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filtered.map((tmpl) => (
          <div
            key={tmpl.id}
            className="bg-white dark:bg-zinc-950 border dark:border-zinc-850 rounded-xl p-5 flex flex-col justify-between hover:border-slate-300 dark:hover:border-zinc-700 transition-colors"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-900 dark:text-zinc-100">{tmpl.title}</span>
                <span className="text-[10px] text-slate-600 dark:text-zinc-400 uppercase tracking-wider bg-slate-50 dark:bg-zinc-900 px-2 py-0.5 rounded border border-slate-200 dark:border-zinc-800">
                  {tmpl.category}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-zinc-400 mb-4 leading-relaxed">{tmpl.description}</p>
              <div className="bg-slate-50/40 dark:bg-zinc-900/40 p-3 rounded-lg border dark:border-zinc-850 text-[11px] font-mono text-slate-600 dark:text-zinc-400 max-h-24 overflow-hidden line-clamp-3 mb-4">
                {tmpl.defaultContent}
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => handleUseTemplate(tmpl)}
              className="w-full"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Use This Template</span>
            </Button>
          </div>
        ))}
      </div>

      {/* Create Custom Template Modal */}
      {isCustomModalOpen && (
        <Modal
          isOpen={isCustomModalOpen}
          onClose={() => setIsCustomModalOpen(false)}
          title="New Workspace Template"
          description="Design a reusable structure for your notes and operations"
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 dark:text-zinc-300 font-medium mb-1">Template Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g., Weekly Incident Retrospective"
                className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-md p-2.5 text-slate-800 dark:text-zinc-200 focus:outline-none focus:border-slate-300 dark:focus:border-zinc-700"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-zinc-300 font-medium mb-1">Category</label>
              <select
                value={newCategory}
                onChange={(e: any) => setNewCategory(e.target.value)}
                className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-md p-2.5 text-slate-800 dark:text-zinc-200 focus:outline-none focus:border-slate-300 dark:focus:border-zinc-700"
              >
                <option value="general">General</option>
                <option value="meeting">Meeting</option>
                <option value="operation">Operation</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-zinc-300 font-medium mb-1">Default Markdown Content</label>
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={6}
                placeholder="# Heading\n\n- [ ] Task 1..."
                className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-md p-2.5 text-slate-800 dark:text-zinc-200 font-mono text-xs focus:outline-none focus:border-slate-300 dark:focus:border-zinc-700"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setIsCustomModalOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={handleCreateCustom}>
                Save Template
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
