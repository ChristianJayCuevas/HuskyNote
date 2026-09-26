/**
 * HuskyNote Visual Participant Scanner
 * ─────────────────────────────────────────────────────────────────────────────
 * Works WITHOUT the Chrome extension.
 * Captures frames from the active screen share stream, sends them to the local
 * Ollama vision model (llava-phi3), and extracts participant/speaker names.
 *
 * Supported meeting apps (anything visible on screen):
 * Google Meet, Zoom, Microsoft Teams, Webex, Slack Huddles, Discord, Jitsi, etc.
 *
 * The scanner runs every SCAN_INTERVAL_MS during recording and feeds results
 * into the speakerHookManager — identical to how the Chrome extension does.
 */

import { speakerHookManager, cleanSpeakerName } from './speaker-detector';

const SCAN_INTERVAL_MS = 7000;      // Scan every 7 seconds (vision model is slow)
const OLLAMA_URL = 'http://localhost:11434';
const VISION_MODELS = ['llava-phi3:latest', 'llava:latest', 'llava:7b', 'bakllava:latest'];

// Common UI labels to ignore when parsing model output
const IGNORE_LABELS = new Set([
  'you', 'host', 'guest', 'meeting host', 'co-host', 'external', 'presenter',
  'organizer', 'organiser', 'muted', 'speaking', 'video off', 'no video',
  'all muted', 'add people', 'search for people', 'in the meeting', 'contributors',
  'track attendance', 'stop sharing', 'sharing', 'participants', 'people', 'chat',
  'more options', 'reactions', 'raise hand', 'leave', 'end', 'close',
  'settings', 'whiteboard', 'breakout rooms', 'recording', 'captions',
  'transcript', 'notes', 'bookmarks', 'screenshot', 'report', 'snip', 'full',
  'stop', 'pause', 'resume', 'start', 'record', 'share', 'present',
  'mic', 'camera', 'screen', 'audio', 'video', 'pin', 'unpin',
  'spotlight', 'tile', 'grid', 'speaker view', 'gallery view',
  'huskynote', 'husky', 'note', 'secretary', 'workspace', 'home',
  'meetings', 'schedule', 'documents', 'settings', 'templates',
]);

let availableVisionModel: string | null | undefined = undefined; // undefined = not yet checked

/**
 * Check which vision models are available in Ollama.
 * Caches the result so we only check once per session.
 */
export async function detectVisionModel(): Promise<string | null> {
  if (availableVisionModel !== undefined) return availableVisionModel;

  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!res.ok) {
      availableVisionModel = null;
      return null;
    }
    const data = await res.json();
    const installed: string[] = (data.models || []).map((m: any) => m.name as string);

    for (const model of VISION_MODELS) {
      if (installed.some(m => m.startsWith(model.split(':')[0]))) {
        availableVisionModel = installed.find(m => m.startsWith(model.split(':')[0])) || model;
        console.log(`[HuskyNote VisualScan] Using vision model: ${availableVisionModel}`);
        return availableVisionModel;
      }
    }

    availableVisionModel = null;
    console.info('[HuskyNote VisualScan] No vision model found. Install llava-phi3 with: ollama pull llava-phi3');
    return null;
  } catch {
    availableVisionModel = null;
    return null;
  }
}

/**
 * Capture a single frame from a <video> element as a base64 PNG.
 * Downscales to max 720px wide to keep Ollama inference fast.
 */
export function captureVideoFrame(videoEl: HTMLVideoElement): string | null {
  try {
    if (!videoEl || !videoEl.videoWidth || !videoEl.videoHeight) return null;

    const MAX_WIDTH = 720;
    const scale = Math.min(1, MAX_WIDTH / videoEl.videoWidth);
    const w = Math.round(videoEl.videoWidth * scale);
    const h = Math.round(videoEl.videoHeight * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(videoEl, 0, 0, w, h);
    // Get base64 without the data URL prefix
    const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
    return dataUrl.split(',')[1] || null;
  } catch {
    return null;
  }
}

/**
 * Ask the vision model to extract participant names from a meeting screenshot.
 * Returns a list of cleaned, validated names.
 */
export async function extractParticipantsFromFrame(
  imageBase64: string,
  visionModel: string
): Promise<{ names: string[]; selfName: string | null }> {
  const prompt = `You are a precision meeting OCR reader. Look closely at this meeting screenshot (Google Meet / Zoom / Microsoft Teams).
Extract ONLY real participant names actually visible in the video tiles, participants sidebar, or active speaker subtitles.

CRITICAL RULES:
1. ONLY return real human names you can legibly read in the image.
2. NEVER invent, hallucinate, or guess placeholder names. NEVER output "Name1", "Name2", "John Doe", "Jane Smith", "Speaker 1".
3. If no participant names are legible, return: {"participants": [], "selfParticipant": null}
4. Strip UI roles like "(You)", "(Host)", "(Co-host)", "(Muted)".
5. If a participant name has "(You)" next to it, place that exact name in "selfParticipant".

Return ONLY valid JSON in this exact structure:
{
  "participants": [],
  "selfParticipant": null
}`;

  const DUMMY_NAMES = new Set([
    'name1', 'name2', 'name3', 'name4', 'name5',
    'john doe', 'jane doe', 'jane smith', 'john smith', 'smith', 'doe',
    'john', 'jane', 'foo bar', 'sample name', 'test user', 'dummy user',
    'participant', 'participant 1', 'participant 2', 'speaker', 'speaker 1', 'speaker 2',
    'user', 'user 1', 'user 2', 'example name', 'placeholder', 'host', 'you',
    'none', 'n/a', 'null',
  ]);

  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: visionModel,
        prompt,
        images: [imageBase64],
        stream: false,
        options: { temperature: 0.1, num_predict: 200 },
      }),
    });

    if (!res.ok) return { names: [], selfName: null };
    const data = await res.json();
    const response: string = data.response || '';

    // Parse JSON object from response (handle markdown code blocks)
    const jsonMatch = response.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) return { names: [], selfName: null };

    const parsed = JSON.parse(jsonMatch[0]);
    const rawNames: string[] = Array.isArray(parsed.participants) ? parsed.participants : [];
    const rawSelf: string | null = typeof parsed.selfParticipant === 'string' ? parsed.selfParticipant : null;

    // Clean and validate each name
    const cleanName = (raw: string): string | null => {
      const stripped = raw
        .replace(/\s*\((?:you|host|co-host|guest|muted|external|presenter)\)/gi, '')
        .replace(/\s*(?:meeting host|is muted|is speaking).*$/i, '')
        .trim();
      const cleaned = cleanSpeakerName(stripped);
      if (!cleaned) return null;
      const lower = cleaned.toLowerCase();
      if (IGNORE_LABELS.has(lower)) return null;
      if (DUMMY_NAMES.has(lower)) return null;
      if (/^(?:name|speaker|participant|user)\s*\d*$/i.test(cleaned)) return null;
      if (cleaned.length < 2 || cleaned.length > 50) return null;
      if (/https?:|localhost|\d{2}:\d{2}/.test(cleaned)) return null;
      return cleaned;
    };

    const names = rawNames.map(cleanName).filter(Boolean) as string[];
    const selfName = rawSelf ? cleanName(rawSelf) : null;

    return { names, selfName };
  } catch {
    return { names: [], selfName: null };
  }
}

/**
 * Main visual scan runner.
 * Call startVisualParticipantScanner() when recording starts.
 * Call the returned stop function when recording stops.
 *
 * @param getVideoEl - Function that returns the current screenVideoRef (may change)
 * @param onParticipantsFound - Callback with detected names + app label
 */
export function startVisualParticipantScanner(
  getVideoEl: () => HTMLVideoElement | null,
  onParticipantsFound?: (names: string[], source: string) => void
): () => void {
  let stopped = false;
  let scanTimer: ReturnType<typeof setTimeout> | null = null;
  let visionModel: string | null = null;
  let lastScanSignature = '';

  const scan = async () => {
    if (stopped) return;

    try {
      // Lazily detect vision model
      if (visionModel === null && availableVisionModel === undefined) {
        visionModel = await detectVisionModel();
      } else if (visionModel === null) {
        visionModel = availableVisionModel ?? null;
      }

      if (!visionModel) {
        // No vision model: reschedule silently (extension may still work)
        if (!stopped) scanTimer = setTimeout(scan, SCAN_INTERVAL_MS);
        return;
      }

      const videoEl = getVideoEl();
      const imageBase64 = videoEl ? captureVideoFrame(videoEl) : null;

      if (!imageBase64) {
        if (!stopped) scanTimer = setTimeout(scan, SCAN_INTERVAL_MS);
        return;
      }

      // Detect app name from document title or URL hint
      const appHint = detectAppFromTab();

      const { names, selfName } = await extractParticipantsFromFrame(imageBase64, visionModel);

      if (names.length > 0) {
        // Deduplicate with previous scan to avoid redundant updates
        const signature = [...names].sort().join(',');
        if (signature !== lastScanSignature) {
          lastScanSignature = signature;

          // Feed directly into speakerHookManager (same pipeline as extension)
          speakerHookManager.handleIncomingPayload({
            type: 'HUSKYNOTE_MEETING_PARTICIPANTS',
            app: appHint,
            participants: names,
            selfParticipant: selfName || undefined,
          });

          onParticipantsFound?.(names, appHint);
          console.log(`[HuskyNote VisualScan] Found participants via ${visionModel}:`, names);
        }
      }
    } catch (err) {
      console.warn('[HuskyNote VisualScan] Scan error:', err);
    }

    if (!stopped) scanTimer = setTimeout(scan, SCAN_INTERVAL_MS);
  };

  // Start first scan after a short delay (let meeting UI render)
  scanTimer = setTimeout(scan, 2500);

  return () => {
    stopped = true;
    if (scanTimer !== null) clearTimeout(scanTimer);
  };
}

/**
 * Guess the meeting app from the current page title or URL.
 * Used to label discovered participants with the correct source.
 */
function detectAppFromTab(): string {
  // In a tab capture, the document title or URL usually reflects HuskyNote's page
  // but we can sniff from the label of the video track or stored appName
  const title = document.title.toLowerCase();
  if (title.includes('meet') || title.includes('google')) return 'Google Meet';
  if (title.includes('teams') || title.includes('microsoft')) return 'Microsoft Teams';
  if (title.includes('zoom')) return 'Zoom';
  if (title.includes('webex') || title.includes('cisco')) return 'Cisco Webex';
  if (title.includes('slack')) return 'Slack Huddle';
  if (title.includes('discord')) return 'Discord';
  if (title.includes('jitsi') || title.includes('8x8')) return 'Jitsi Meet';
  return 'Meeting';
}
