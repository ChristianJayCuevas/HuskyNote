import Dexie, { type Table } from 'dexie';
import type {
  Note,
  Meeting,
  DocumentEntity,
  Annotation,
  OperationSession,
  Manual,
  Template,
  AppSettings,
  StoredBlob,
  ScheduleEvent,
} from '../types';
import { DEFAULT_PROFILE_ID, createProfile, getActiveProfileId, profileDatabaseName, removeProfile, type Profile } from '../services/profiles';

export class HuskyNoteDatabase extends Dexie {
  notes!: Table<Note, string>;
  meetings!: Table<Meeting, string>;
  documents!: Table<DocumentEntity, string>;
  annotations!: Table<Annotation, string>;
  operationSessions!: Table<OperationSession, string>;
  manuals!: Table<Manual, string>;
  templates!: Table<Template, string>;
  settings!: Table<AppSettings, string>;
  blobs!: Table<StoredBlob, string>;
  schedule!: Table<ScheduleEvent, string>;

  /** Each profile has its own database; the default profile keeps the original name */
  constructor(name: string = profileDatabaseName(DEFAULT_PROFILE_ID)) {
    super(name);
    this.version(1).stores({
      notes: 'id, title, folderId, createdAt, updatedAt, *tags',
      meetings: 'id, title, startTime, createdAt',
      documents: 'id, title, fileName, createdAt',
      annotations: 'id, documentId, pageNumber, createdAt',
      operationSessions: 'id, title, recordedAt',
      manuals: 'id, title, createdAt, updatedAt',
      templates: 'id, title, category, isBuiltin',
      settings: 'id',
      blobs: 'id, mimeType, createdAt',
    });
    this.version(2).stores({
      schedule: 'id, date, time, category, completed, createdAt',
    });
  }
}

// The open profile's data. Switching profiles reloads the app, which reopens this with the new database.
export const db = new HuskyNoteDatabase(profileDatabaseName(getActiveProfileId()));

// Default Application Settings
export const DEFAULT_SETTINGS: AppSettings = {
  id: 'current',
  ollamaBaseUrl: 'http://localhost:11434',
  selectedModel: '',
  companionUrl: 'http://localhost:8765',
  theme: 'dark',
  autoSaveIntervalSeconds: 3,
  speechLanguage: 'auto',
};

// Built-in Templates
export const BUILTIN_TEMPLATES: Template[] = [
  {
    id: 'template-meeting-notes',
    title: 'Standard Meeting Notes',
    category: 'meeting',
    description: 'Structured outline for discussions, decisions, and action items.',
    defaultContent: `# Meeting Title\n\n**Date:** [Date]\n**Participants:** [Names]\n\n## Agenda\n- Discussion point 1\n- Discussion point 2\n\n## Key Notes\n- \n\n## Decisions Made\n- \n\n## Action Items\n- [ ] Task 1 - Assigned to @person\n- [ ] Task 2 - Assigned to @person\n`,
    isBuiltin: true,
  },
  {
    id: 'template-project-sync',
    title: 'Project Sync',
    category: 'meeting',
    description: 'Status alignment on progress, blockers, and upcoming milestones.',
    defaultContent: `# Project Sync: [Project Name]\n\n**Date:** [Date]\n\n## Current Status\n- What was completed this cycle\n- What is currently in progress\n\n## Blockers & Risks\n- Blocker 1\n\n## Next Steps\n- Milestone goal for next week\n`,
    isBuiltin: true,
  },
  {
    id: 'template-operation-sop',
    title: 'Standard Operating Procedure (SOP)',
    category: 'operation',
    description: 'Formal step-by-step procedure manual with requirements and troubleshooting.',
    defaultContent: `# SOP: [Procedure Name]\n\n**Purpose:** [Describe the objective of this standard procedure]\n\n## Prerequisites & Requirements\n- Required permissions\n- Required environment or access\n\n## Step-by-Step Procedure\n1. Step 1: Open the management interface\n2. Step 2: Navigate to configuration parameters\n3. Step 3: Apply the required changes\n\n## Verification & Expected Result\n- How to confirm the procedure succeeded\n\n## Troubleshooting\n- Common error scenarios and mitigations\n`,
    isBuiltin: true,
  },
  {
    id: 'template-bug-investigation',
    title: 'Bug Investigation & Root Cause',
    category: 'general',
    description: 'Investigation log for reproducing, analyzing, and resolving software defects.',
    defaultContent: `# Bug Investigation: [Issue Summary]\n\n**Severity:** High / Medium / Low\n**Environment:** Production / Staging / Local\n\n## Symptoms\n- Observed behavior\n- Expected behavior\n\n## Reproduction Steps\n1. \n2. \n3. \n\n## Root Cause Analysis\n- Technical explanation of the defect\n\n## Remediation Plan\n- [ ] Proposed fix\n- [ ] Verification test\n`,
    isBuiltin: true,
  },
  {
    id: 'template-daily-log',
    title: 'Daily Engineering Log',
    category: 'general',
    description: 'Concise daily record of completed tasks, discoveries, and notes.',
    defaultContent: `# Daily Log - [Date]\n\n## Focus for Today\n- [ ] Primary goal\n- [ ] Secondary task\n\n## Progress & Insights\n- Notes on what was implemented or learned\n\n## Tomorrow's Priorities\n- \n`,
    isBuiltin: true,
  },
  {
    id: 'template-adr',
    title: 'Architecture Decision Record (ADR)',
    category: 'general',
    description: 'Record an architectural decision and its context and consequences.',
    defaultContent: `# ADR [Number]: [Title]\n\n**Status:** Proposed / Accepted / Superseded\n**Deciders:** [Names]\n**Date:** [Date]\n\n## Context\nWhat is the problem or architectural challenge we are addressing?\n\n## Decision\nWhat is the change or approach we are committing to?\n\n## Consequences\n- Positive trade-offs\n- Negative trade-offs or constraints\n`,
    isBuiltin: true,
  },
];

// Initialize database with default settings and built-in templates
export async function initializeDatabase(): Promise<void> {
  // Ensure settings exist
  const existingSettings = await db.settings.get('current');
  if (!existingSettings) {
    await db.settings.put(DEFAULT_SETTINGS);
  } else if (!existingSettings.speechLanguage || existingSettings.speechLanguage === 'en-US') {
    // Default spoken language is auto detect
    await db.settings.update('current', { speechLanguage: 'auto' });
  }

  // Seed built-in templates if empty
  const templateCount = await db.templates.count();
  if (templateCount === 0) {
    await db.templates.bulkPut(BUILTIN_TEMPLATES);
  }
}

/**
 * Creates a profile and copies this profile's settings into it, so the AI
 * provider, API key, and transcription choices carry over. Everything else
 * starts empty.
 */
export async function createProfileWithSettings(name: string): Promise<Profile> {
  const profile = createProfile(name);
  const settings = await db.settings.get('current');
  if (settings) {
    const target = new HuskyNoteDatabase(profileDatabaseName(profile.id));
    try {
      await target.settings.put(settings);
    } finally {
      target.close();
    }
  }
  return profile;
}

/** Permanently deletes a profile and all of its notes, meetings, documents, and settings. */
export async function deleteProfileAndData(profileId: string): Promise<void> {
  if (profileId === DEFAULT_PROFILE_ID) throw new Error('The default profile cannot be deleted.');
  if (profileId === getActiveProfileId()) throw new Error('Switch to another profile before deleting this one.');
  await Dexie.delete(profileDatabaseName(profileId));
  removeProfile(profileId);
}

// Full Workspace Backup & Restore
export async function exportWorkspaceToJson(): Promise<string> {
  const [notes, meetings, documents, annotations, operationSessions, manuals, templates, settings, schedule] =
    await Promise.all([
      db.notes.toArray(),
      db.meetings.toArray(),
      db.documents.toArray(),
      db.annotations.toArray(),
      db.operationSessions.toArray(),
      db.manuals.toArray(),
      db.templates.filter((t) => !t.isBuiltin).toArray(),
      db.settings.get('current'),
      db.schedule.toArray(),
    ]);

  const workspace = {
    version: '1.1.0',
    exportedAt: new Date().toISOString(),
    data: {
      notes,
      meetings,
      documents,
      annotations,
      operationSessions,
      manuals,
      customTemplates: templates,
      // Never write the Claude API key into an exported backup file
      settings: { ...(settings || DEFAULT_SETTINGS), claudeApiKey: undefined },
      schedule,
    },
  };

  return JSON.stringify(workspace, null, 2);
}

export async function importWorkspaceFromJson(jsonString: string): Promise<{ success: boolean; message: string }> {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || !parsed.data) {
      throw new Error('Invalid workspace archive format: missing data key.');
    }

    const { notes, meetings, documents, annotations, operationSessions, manuals, customTemplates, schedule } = parsed.data;

    await db.transaction('rw', [db.notes, db.meetings, db.documents, db.annotations, db.operationSessions, db.manuals, db.templates, db.schedule], async () => {
      if (Array.isArray(notes)) await db.notes.bulkPut(notes);
      if (Array.isArray(meetings)) await db.meetings.bulkPut(meetings);
      if (Array.isArray(documents)) await db.documents.bulkPut(documents);
      if (Array.isArray(annotations)) await db.annotations.bulkPut(annotations);
      if (Array.isArray(operationSessions)) await db.operationSessions.bulkPut(operationSessions);
      if (Array.isArray(manuals)) await db.manuals.bulkPut(manuals);
      if (Array.isArray(customTemplates)) await db.templates.bulkPut(customTemplates);
      if (Array.isArray(schedule)) await db.schedule.bulkPut(schedule);
    });

    return { success: true, message: 'Workspace successfully imported.' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to import workspace archive.' };
  }
}
