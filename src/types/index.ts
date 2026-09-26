// HuskyNote Canonical TypeScript Domain Models
// Strictly typed, normalized entities for local-first storage and AI pipelines.

export interface NoteVersion {
  id: string;
  timestamp: number;
  title: string;
  content: string;
  changeSummary?: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  folderId?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  versions: NoteVersion[];
}

export interface TranscriptSegment {
  id: string;
  timestampSeconds: number;
  speaker: string;
  text: string;
  originalText?: string;
  translation?: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  isTranslating?: boolean;
}

export interface TimelineItem {
  id: string;
  timestampSeconds: number;
  timeFormatted: string;
  label: string;
  type: 'topic' | 'decision' | 'action' | 'note';
}

export interface MeetingSummary {
  overview: string;
  decisions: string[];
  actionItems: Array<{
    task: string;
    owner?: string;
  }>;
  topics: string[];
  followUpTasks: string[];
  summaryLanguage?: string;
}

/** A screenshot captured during a live meeting recording session. */
export interface MeetingScreenshot {
  id: string;
  timestampSeconds: number;
  dataUrl: string;
  caption?: string;
  type?: 'full' | 'portion';
  cropDimensions?: { width: number; height: number };
}

export interface Meeting {
  id: string;
  title: string;
  startTime: number;
  endTime?: number;
  durationSeconds: number;
  audioBlobId?: string;
  transcript: TranscriptSegment[];
  manualNotes: string;
  timeline: TimelineItem[];
  summary?: MeetingSummary;
  screenshots: MeetingScreenshot[];
  createdAt: number;
  spokenLanguage?: string;
  translationLanguage?: string;
}

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface DocumentEntity {
  id: string;
  title: string;
  fileName: string;
  fileSize: number;
  pageCount: number;
  fileBlobId: string;
  extractedPages: ExtractedPage[];
  createdAt: number;
}

export type AnnotationType = 'highlight' | 'underline' | 'rectangle' | 'arrow' | 'marker' | 'note';

export interface AnnotationCoords {
  x: number;      // percentage (0-100) or pixel
  y: number;
  width: number;
  height: number;
}

export interface Annotation {
  id: string;
  documentId: string;
  pageNumber: number;
  type: AnnotationType;
  coords: AnnotationCoords;
  color: string;
  text?: string;
  label?: string;
  stepNumber?: number;
  createdAt: number;
}

export interface SuggestedAnnotation {
  id: string;
  pageNumber: number;
  category: 'Important' | 'Definition' | 'Step' | 'Warning' | 'Requirement';
  text: string;
  coords: AnnotationCoords;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface DocumentStep {
  stepNumber: number;
  title: string;
  explanation: string;
  sourcePage: number;
  sourceText: string;
}

export interface OperationStep {
  id: string;
  stepNumber: number;
  timestamp: number;
  screenshotBlobId?: string;
  screenshotDataUrl?: string;
  actionDescription: string;
  detectedContext?: string;
  clickCoords?: { x: number; y: number };
  annotations: Annotation[];
}

export interface OperationSession {
  id: string;
  title: string;
  recordedAt: number;
  durationSeconds: number;
  steps: OperationStep[];
}

export interface ManualStep {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  screenshotBlobId?: string;
  screenshotDataUrl?: string;
  warnings?: string;
  notes?: string;
}

export interface Manual {
  id: string;
  title: string;
  purpose: string;
  requirements: string[];
  steps: ManualStep[];
  warnings: string[];
  expectedResult: string;
  troubleshooting: string[];
  createdAt: number;
  updatedAt: number;
  version: number;
}

export interface Template {
  id: string;
  title: string;
  category: 'meeting' | 'document' | 'operation' | 'general';
  description: string;
  defaultContent: string;
  isBuiltin: boolean;
}

export interface AppSettings {
  id: string; // 'current'
  ollamaBaseUrl: string;
  selectedModel: string;
  companionUrl: string;
  theme: 'dark';
  autoSaveIntervalSeconds: number;
  speechLanguage: string;
}

export interface StoredBlob {
  id: string;
  data: Blob;
  mimeType: string;
  fileName?: string;
  createdAt: number;
}

export interface OllamaModel {
  name: string;
  model: string;
  size: number;
  modified_at: string;
  details?: {
    format?: string;
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
  capabilities?: string[];
}

export interface AIContextChip {
  id: string;
  type: 'note' | 'meeting' | 'document';
  title: string;
  content: string;
  pageNumber?: number;
}

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: Array<{
    title: string;
    pageNumber?: number;
    textSnippet?: string;
  }>;
  timestamp: number;
}

export type ScheduleCategory = 'meeting' | 'deep-work' | 'review' | 'manual' | 'deadline';

export interface ScheduleEvent {
  id: string;
  title: string;
  date: string; // ISO format: YYYY-MM-DD
  time: string; // 24h format: HH:MM
  durationMin: number;
  category: ScheduleCategory;
  completed: boolean;
  notes?: string;
  detectedFrom?: {
    source: 'transcript' | 'meeting' | 'note' | 'manual' | 'ai';
    sourceId?: string;
    sourceTitle?: string;
    snippet?: string;
  };
  addedToComputerCalendar?: boolean;
  googleCalendarEventId?: string;
  syncedToGoogle?: boolean;
  createdAt: number;
  updatedAt?: number;
}

export interface GoogleCalendarConfig {
  clientId?: string;
  accessToken?: string;
  tokenExpiry?: number;
  userEmail?: string;
  isConnected: boolean;
  lastSyncedAt?: number;
}
