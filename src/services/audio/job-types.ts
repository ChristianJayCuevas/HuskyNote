export interface AudioChunkRecord {
  id: string;
  recordingId: string;
  sequence: number;
  data: Blob;
  createdAt: number;
}

export interface SpeechJob {
  id: string;
  meetingId: string;
  sequence: number;
  startSeconds: number;
  language: string;
  speaker: string;
  engineId: string;
  audio: Float32Array;
  error?: string;
  attempts: number;
}
