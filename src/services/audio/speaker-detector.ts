/**
 * HuskyNote Automatic Speaker Hook & Multi-App Participant Attribution Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Automatically hooks into meeting apps (Google Meet, Microsoft Teams, Zoom,
 * Cisco Webex, Slack Huddles, Discord, Jitsi Meet, Skype) to detect real participant
 * names, track active speaking turns, and eliminate generic "Speaker 1" / "Speaker 2" labels.
 *
 * Capabilities:
 * 1. Multi-App DOM Hooking (via Companion Extension / Cross-tab Broadcast Channel)
 * 2. Conversational In-Speech Self-Identification ("Hi, this is Sarah", "Alex here", etc.)
 * 3. Conversational Question & Handoff Prediction ("Over to you, David")
 * 4. Active Speaker & Live Subtitle Synchronization
 * 5. Dynamic Speaker Roster Management & Retroactive Attribution
 */

export interface DiscoveredSpeaker {
  name: string;
  source: 'google-meet' | 'teams' | 'zoom' | 'webex' | 'slack' | 'discord' | 'jitsi' | 'skype' | 'conversational' | 'manual';
  confidence: number; // 0.0 to 1.0
  firstSeen: number;
  lastActive: number;
  isSelf?: boolean;
}

export interface MeetingSyncPayload {
  type: 'HUSKYNOTE_MEETING_PARTICIPANTS' | 'HUSKYNOTE_ACTIVE_SPEAKER';
  app?: string;
  participants?: string[];
  activeSpeaker?: string;
  selfParticipant?: string; // The local user's real name (the (You) participant)
  timestamp?: number;
}

/**
 * Filter and sanitize names scraped from DOM or conversational speech.
 * Strips UI artifacts like "(You)", "(Host)", "(Guest)", emojis, and rejects buttons.
 */
export function cleanSpeakerName(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;

  let cleaned = raw
    // Remove UI role labels
    .replace(/\s*\((?:you|host|co-host|guest|external|presenter|organiser|organizer|presentation|joined|leaving)\)/gi, '')
    // Remove trailing status or badge numbers (e.g. "Sarah (3)")
    .replace(/\s*\(\d+\)$/, '')
    // Remove trailing prepositions if captured in name parsing
    .replace(/\s+(?:from|with|at|on|for|here|speaking|para|sa|po)(?:\s+.*)?$/i, '')
    // Remove emojis and special icon characters
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    // Remove trailing/leading punctuation and excess whitespace
    .replace(/^[^a-zA-Z0-9\u3040-\u30FF\u4E00-\u9FAF]+|[^a-zA-Z0-9\u3040-\u30FF\u4E00-\u9FAF]+$/g, '')
    .trim();

  // Strip common generic prefixes
  cleaned = cleaned.replace(/^(?:speaker|participant|user|guest)\s*\d*$/i, '').trim();

  // Exclude common UI button labels & meeting actions
  const UI_BLACKLIST = new Set([
    'mute',
    'unmute',
    'turn off microphone',
    'turn on microphone',
    'turn off camera',
    'turn on camera',
    'raise hand',
    'lower hand',
    'leave call',
    'end call',
    'leave meeting',
    'participants',
    'people',
    'chat',
    'more options',
    'show more',
    'pin to screen',
    'unpin',
    'settings',
    'share screen',
    'present now',
    'whiteboard',
    'breakout rooms',
    'recording',
    'captions',
    'closed captions',
    'audio',
    'video',
    'search',
    'close',
    'cancel',
    'apply',
    'ok',
    'yes',
    'no',
    'track attendance',
    'stop sharing',
    'sharing this tab',
    'meeting details',
    'info',
  ]);

  // Exclude dummy, placeholder, or static mock names
  const DUMMY_NAMES = new Set([
    'name1',
    'name2',
    'name3',
    'name4',
    'name5',
    'john doe',
    'jane doe',
    'jane smith',
    'john smith',
    'smith',
    'doe',
    'foo bar',
    'sample name',
    'test user',
    'dummy user',
    'participant 1',
    'participant 2',
    'speaker 1',
    'speaker 2',
    'user 1',
    'user 2',
    'example name',
    'placeholder',
    'none',
    'n/a',
    'null',
    'undefined',
  ]);

  // Exclude common adjectives, pronouns and non-name words following "this is", "it is"
  const NON_NAME_WORDS = new Set([
    'great',
    'good',
    'bad',
    'working',
    'going',
    'happening',
    'ready',
    'fine',
    'cool',
    'ok',
    'okay',
    'nice',
    'awesome',
    'weird',
    'crazy',
    'interesting',
    'true',
    'false',
    'done',
    'important',
    'critical',
    'amazing',
    'a',
    'an',
    'the',
    'it',
    'not',
    'here',
    'there',
    'our',
    'your',
    'my',
    'what',
    'how',
    'why',
    'who',
    'when',
    'where',
    'this',
    'that',
    'these',
    'those',
    'all',
    'team',
    'everyone',
    'guys',
    'properly',
    'sure',
    'well',
    'really',
    'just',
    'too',
    'very',
    'still',
    'already',
    'now',
    'right',
    'wrong',
    'normal',
    'broken',
    'better',
    'best',
    'first',
    'last',
  ]);

  const cleanedLower = cleaned.toLowerCase();
  if (
    UI_BLACKLIST.has(cleanedLower) ||
    NON_NAME_WORDS.has(cleanedLower) ||
    DUMMY_NAMES.has(cleanedLower) ||
    /^(?:name|speaker|participant|user)\s*\d*$/i.test(cleanedLower)
  ) {
    return null;
  }

  // Reject multi-word candidates where any constituent word is in NON_NAME_WORDS (e.g. "working properly")
  const words = cleanedLower.split(/\s+/);
  if (words.some((w) => NON_NAME_WORDS.has(w))) {
    return null;
  }

  // Reject strings that are too short, too long, or pure numbers/time formats
  if (cleaned.length < 2 || cleaned.length > 50) return null;
  if (/^\d+([:.]\d+)?$/.test(cleaned)) return null;

  // Title-case format the name so lowercase speech recognition (e.g. "liz", "german") becomes "Liz", "German"
  cleaned = cleaned
    .split(/\s+/)
    .map((word) => {
      if (/^(?:dr\.|prof\.|mr\.|ms\.|mrs\.)$/i.test(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');

  return cleaned;
}

/**
 * Detect conversational self-introductions or direct speaker handoffs in spoken speech.
 * Example self-intros:
 * - "Hi everyone, this is Arron from engineering" -> "Arron"
 * - "Hey team, Sarah here, just wanted to check" -> "Sarah"
 * - "My name is Dr. Watson" -> "Dr. Watson"
 * - "Alex speaking, let me present my screen" -> "Alex"
 * - "Ako nga pala si Maria para sa report ngayon" -> "Maria"
 * - "Si John ito" -> "John"
 *
 * Example handoffs:
 * - "Over to you, Sarah" -> handoff to "Sarah"
 * - "David, what do you think?" -> handoff to "David"
 * - "Thanks Michael" -> previous or next speaker "Michael"
 */
export function detectConversationalSpeaker(
  text: string,
  knownRoster: string[] = []
): {
  name: string;
  isSelfIntro: boolean;
  isHandoff: boolean;
  confidence: number;
} | null {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();

  // 1. Direct Self-Introductions (High Confidence)
  const selfIntroPatterns = [
    // "guys my name is liz from ivy", "hi everyone, my name is Alex", "hello this is Sarah Jenkins"
    /(?:(?:hi|hello|hey|good\s+(?:morning|afternoon|evening)|guys|team|all|everyone|yo|welcome)[,\s]+)*(?:this\s+is|it'?s|i'?m|i\s+am|my\s+name\s+is|call\s+me)\s+((?:(?:Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s*)?[a-zA-Z'\-]+(?:\s+[a-zA-Z'\-]+)?)/i,
    // "Sarah here, just wanted to update" or "Hey team, Sarah Jenkins here" or "Dr. Watson speaking" or "liz here"
    /(?:^|[,\s]+)((?:(?:Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s*)?[a-zA-Z'\-]+(?:\s+[a-zA-Z'\-]+)?)\s+(?:here|speaking)\b/i,
    // Direct standalone: "my name is liz", "this is liz", "i'm liz"
    /\b(?:my\s+name\s+is|this\s+is|it'?s|i'?m|i\s+am|call\s+me)\s+((?:(?:Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s*)?[a-zA-Z'\-]+(?:\s+[a-zA-Z'\-]+)?)\b/i,
    // "I am Alex from Product", "i'm liz from ivy"
    /\b(?:i\s+am|i'm)\s+([a-zA-Z'\-]+(?:\s+[a-zA-Z'\-]+)?)\s+(?:from|with|on)\b/i,
    // Filipino self-intros: "Ako nga pala si Maria", "Si Arron ito"
    /\b(?:ako\s+nga\s+pala\s+si|si)\s+([a-zA-Z'\-]+(?:\s+[a-zA-Z'\-]+)?)(?:\s+(?:ito|dito|po\s+ito|para|sa|ang|ng))?/i,
  ];

  for (const pattern of selfIntroPatterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      const candidate = cleanSpeakerName(match[1]);
      if (candidate) {
        return {
          name: candidate,
          isSelfIntro: true,
          isHandoff: false,
          confidence: 0.95,
        };
      }
    }
  }

  // 2. Direct Address / Handoffs (Medium-High Confidence)
  const handoffPatterns = [
    // "Over to you, Sarah", "Your turn, Alex", "Take it away, Marcus", "Over to you, german"
    /(?:over\s+to\s+you|your\s+turn|take\s+it\s+away|handing\s+over\s+to)[,\s]+([a-zA-Z'\-]+)\b/i,
    // "Sarah, what do you think about...", "Alex, can you take this one?"
    /^([a-zA-Z'\-]+)[,\s]+(?:what\s+do\s+you\s+think|can\s+you|could\s+you|do\s+you\s+have|would\s+you)\b/i,
    // "...what are your thoughts, David?"
    /(?:what\s+(?:are\s+your|do\s+you)\s+thoughts|any\s+thoughts)[,\s]+([a-zA-Z'\-]+)\??$/i,
  ];

  for (const pattern of handoffPatterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      const candidate = cleanSpeakerName(match[1]);
      if (candidate) {
        return {
          name: candidate,
          isSelfIntro: false,
          isHandoff: true,
          confidence: 0.85,
        };
      }
    }
  }

  // 3. Known Roster Cross-Match ("Thanks Sarah")
  if (knownRoster.length > 0) {
    for (const known of knownRoster) {
      if (known.toLowerCase() === 'you / host') continue;
      const firstName = known.split(/\s+/)[0];
      if (firstName.length < 3) continue;

      const mentionRegex = new RegExp(`\\b(?:thanks|thank\\s+you|hey|hi)\\s+${firstName}\\b`, 'i');
      if (mentionRegex.test(trimmed)) {
        return {
          name: known,
          isSelfIntro: false,
          isHandoff: true,
          confidence: 0.75,
        };
      }
    }
  }

  return null;
}

/**
 * Universal meeting speaker hook listener.
 * Connects via BroadcastChannel and window message events to sync participants
 * from browser extension content scripts running in Google Meet, Teams, Zoom, etc.
 */
export class MeetingSpeakerHook {
  private static instance: MeetingSpeakerHook | null = null;
  private channel: BroadcastChannel | null = null;
  private listeners: Set<(roster: string[], app: string | null, activeSpeaker: string | null) => void> = new Set();

  private discoveredSpeakers: Map<string, DiscoveredSpeaker> = new Map();
  private detectedApp: string | null = null;
  private activeSpeaker: string | null = null;
  private selfName: string | null = null; // Real name of the local user (replaces 'You / Host')
  private pendingHandoff: string | null = null;
  private pendingIntroPrefix: boolean = false;

  private constructor() {
    this.initBroadcastChannel();
    this.initWindowListener();
  }

  public static getInstance(): MeetingSpeakerHook {
    if (!MeetingSpeakerHook.instance) {
      MeetingSpeakerHook.instance = new MeetingSpeakerHook();
    }
    return MeetingSpeakerHook.instance;
  }

  private initBroadcastChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('huskynote_meeting_sync');
        this.channel.onmessage = (event) => {
          this.handleIncomingPayload(event.data);
        };
      } catch (err) {
        console.warn('[HuskyNote SpeakerHook] BroadcastChannel unavailable:', err);
      }
    }
  }

  private initWindowListener() {
    if (typeof window !== 'undefined') {
      window.addEventListener('message', (event) => {
        if (event.data?.type === 'HUSKYNOTE_MEETING_PARTICIPANTS' || event.data?.type === 'HUSKYNOTE_ACTIVE_SPEAKER') {
          this.handleIncomingPayload(event.data);
        }
      });
    }
  }

  public handleIncomingPayload(payload: MeetingSyncPayload) {
    if (!payload) return;

    let changed = false;

    if (payload.app) {
      this.detectedApp = payload.app;
    }

    if (Array.isArray(payload.participants) && payload.participants.length > 0) {
      for (const rawName of payload.participants) {
        const cleaned = cleanSpeakerName(rawName);
        if (cleaned && !this.discoveredSpeakers.has(cleaned)) {
          const source = (payload.app?.toLowerCase().replace(/\s+/g, '-') || 'conversational') as any;
          this.discoveredSpeakers.set(cleaned, {
            name: cleaned,
            source,
            confidence: 0.9,
            firstSeen: Date.now(),
            lastActive: Date.now(),
            isSelf: cleaned === this.selfName,
          });
          changed = true;
        }
      }
    }

    // Handle self participant identification (the (You) person in Google Meet)
    if (payload.selfParticipant) {
      const cleanedSelf = cleanSpeakerName(payload.selfParticipant);
      if (cleanedSelf && cleanedSelf !== this.selfName) {
        this.selfName = cleanedSelf;
        // Mark the discovered speaker as self
        if (this.discoveredSpeakers.has(cleanedSelf)) {
          this.discoveredSpeakers.get(cleanedSelf)!.isSelf = true;
        }
        changed = true;
      }
    }

    if (payload.activeSpeaker) {
      const cleaned = cleanSpeakerName(payload.activeSpeaker);
      if (cleaned) {
        this.activeSpeaker = cleaned;
        if (!this.discoveredSpeakers.has(cleaned)) {
          this.discoveredSpeakers.set(cleaned, {
            name: cleaned,
            source: (payload.app?.toLowerCase().replace(/\s+/g, '-') || 'conversational') as any,
            confidence: 0.95,
            firstSeen: Date.now(),
            lastActive: Date.now(),
          });
        } else {
          const spk = this.discoveredSpeakers.get(cleaned)!;
          spk.lastActive = Date.now();
        }
        changed = true;
      }
    }

    if (changed) {
      this.notifyListeners();
    }
  }

  /**
   * Process an incoming segment of spoken text.
   * Automatically attributes to real speaker names and eliminates "Speaker 1" / "Speaker 2".
   */
  public processSegment(
    text: string,
    currentSpeaker: string,
    roster: string[],
    channelHint?: 'host' | 'remote'
  ): {
    assignedSpeaker: string;
    updatedRoster: string[];
    isNewDetection: boolean;
  } {
    let assigned = currentSpeaker;
    let isNewDetection = false;
    const currentList = [...new Set([...roster, ...Array.from(this.discoveredSpeakers.keys())])];

    // Identify high-confidence DOM-sourced speakers (Google Meet / Zoom / Teams scraping)
    const domSpeakers = Array.from(this.discoveredSpeakers.values())
      .filter(s => s.source !== 'conversational' && s.source !== 'manual' && s.confidence >= 0.85);
    const hasDomRoster = domSpeakers.length > 0;

    /**
     * Fuzzy-match a candidate name against known roster.
     * Returns matched roster name or null.
     * Handles: "German" → "German", "Arron" → "Arron Parejas", "aaron" → "Arron Parejas"
     */
    const matchToRoster = (candidate: string): string | null => {
      if (!candidate) return null;
      const c = candidate.toLowerCase().trim();
      for (const known of currentList) {
        if (known.toLowerCase() === 'you / host') continue;
        const knownParts = known.toLowerCase().split(/\s+/);
        // Exact full name match
        if (known.toLowerCase() === c) return known;
        // First name match
        if (knownParts[0] === c) return known;
        // Candidate first name matches known first name
        const candidateParts = c.split(/\s+/);
        if (candidateParts[0] === knownParts[0]) return known;
        // Near-match (1 char diff, same first 3 chars — handles "aaron" vs "arron")
        if (
          Math.abs(knownParts[0].length - candidateParts[0].length) <= 1 &&
          knownParts[0].length >= 3 &&
          knownParts[0].substring(0, 3) === candidateParts[0].substring(0, 3)
        ) {
          return known;
        }
      }
      return null;
    };

    // 0. Handle two-part self-introductions (e.g. segment 1: "hi guys my name is", segment 2: "german")
    if (this.pendingIntroPrefix) {
      this.pendingIntroPrefix = false;
      const candidateWords = text.trim().split(/\s+/).slice(0, 2).join(' ');
      const candidate = cleanSpeakerName(candidateWords);
      if (candidate) {
        const rosterMatch = matchToRoster(candidate);
        if (rosterMatch) {
          // Confirmed — this name matches a known DOM participant
          assigned = rosterMatch;
          this.addSpeaker(rosterMatch, 'conversational', 0.95);
          this.activeSpeaker = rosterMatch;
          isNewDetection = true;
        } else if (!hasDomRoster) {
          // No DOM roster yet — accept any valid name from speech
          assigned = candidate;
          this.addSpeaker(candidate, 'conversational', 0.95);
          this.activeSpeaker = candidate;
          isNewDetection = true;
        }
        // If hasDomRoster but no match: ignore the unknown name, don't pollute roster
      }
    }

    // Check if current text ends with an in-progress self-intro (e.g. "hi guys my name is")
    if (/\b(?:my\s+name\s+is|this\s+is|it'?s|i'?m|i\s+am|ako\s+nga\s+pala\s+si)\s*$/i.test(text.trim())) {
      this.pendingIntroPrefix = true;
    }

    // 1. If audio channel hint is provided (Hardware/Audio Analyser level diarization)
    if (channelHint === 'remote') {
      // Priority: DOM active speaker > most recent DOM-sourced participant > first non-host
      if (this.activeSpeaker && this.activeSpeaker !== 'You / Host') {
        assigned = this.activeSpeaker;
      } else {
        const nonHostDomSpeakers = domSpeakers
          .filter(s => s.name.toLowerCase() !== 'you / host')
          .sort((a, b) => b.lastActive - a.lastActive);
        const nonHostSpeakers = currentList.filter(
          (s) => s.toLowerCase() !== 'you / host' && !/^(?:speaker|participant)\s*\d*$/i.test(s)
        );
        if (nonHostDomSpeakers.length > 0) {
          assigned = nonHostDomSpeakers[0].name;
        } else if (nonHostSpeakers.length > 0) {
          assigned = nonHostSpeakers[0];
        } else {
          assigned = 'Remote Participant';
        }
      }
      this.activeSpeaker = assigned;
      isNewDetection = assigned !== currentSpeaker;
    } else if (channelHint === 'host') {
      assigned = 'You / Host';
      this.activeSpeaker = 'You / Host';
      isNewDetection = currentSpeaker !== 'You / Host';
    }

    // 2. If previous segment was handed off to someone, that handed-off person is speaking now!
    if (this.pendingHandoff) {
      assigned = this.pendingHandoff;
      this.activeSpeaker = this.pendingHandoff;
      this.pendingHandoff = null;
      isNewDetection = true;
    } else {
      // Check for conversational self-introduction or new handoff
      const conversational = detectConversationalSpeaker(text, currentList);
      if (conversational) {
        if (conversational.isSelfIntro) {
          // When DOM roster exists, the self-intro name MUST match a known participant
          const rosterMatch = matchToRoster(conversational.name);
          if (rosterMatch) {
            assigned = rosterMatch;
            this.addSpeaker(rosterMatch, 'conversational', 0.95);
            this.activeSpeaker = rosterMatch;
            isNewDetection = true;
          } else if (!hasDomRoster) {
            // No DOM roster — accept speech-derived name
            assigned = conversational.name;
            this.addSpeaker(conversational.name, 'conversational', 0.95);
            this.activeSpeaker = conversational.name;
            isNewDetection = true;
          }
          // hasDomRoster but no match: reject unknown name silently
        } else if (conversational.isHandoff) {
          const rosterMatch = matchToRoster(conversational.name);
          const resolvedName = rosterMatch || (!hasDomRoster ? conversational.name : null);
          if (resolvedName) {
            this.pendingHandoff = resolvedName;
            this.addSpeaker(resolvedName, 'conversational', 0.85);
          }
        }
      } else if (this.activeSpeaker && this.activeSpeaker !== currentSpeaker && !channelHint) {
        // If a meeting app DOM hook signaled an active speaker
        assigned = this.activeSpeaker;
      }
    }

    // 3. Eradicate generic "Speaker N" / "Participant N" if we have known real participants
    if (/^(?:speaker|participant)\s*\d*$/i.test(assigned) || assigned.toLowerCase() === 'guest' || assigned === 'Remote Participant') {
      const nonHostSpeakers = currentList.filter(
        (s) => s.toLowerCase() !== 'you / host' && !/^(?:speaker|participant)\s*\d*$/i.test(s) && s !== 'Remote Participant'
      );
      if (nonHostSpeakers.length > 0) {
        assigned = nonHostSpeakers[0];
      } else if (channelHint === 'remote') {
        assigned = 'Remote Participant';
      } else {
        assigned = 'You / Host';
      }
    }

    const updatedRoster = [...new Set([
      'You / Host',
      ...currentList.filter(
        (s) => s.toLowerCase() !== 'you / host' && !/^(?:speaker|participant)\s*\d*$/i.test(s) && s !== 'Remote Participant'
      ),
      ...(!/^(?:speaker|participant)\s*\d*$/i.test(assigned) && assigned !== 'Remote Participant' && assigned.toLowerCase() !== 'guest' ? [assigned] : []),
    ])];

    return {
      assignedSpeaker: assigned,
      updatedRoster,
      isNewDetection,
    };
  }

  public reset(): void {
    this.discoveredSpeakers.clear();
    this.detectedApp = null;
    this.activeSpeaker = null;
    this.selfName = null;
    this.pendingHandoff = null;
    this.pendingIntroPrefix = false;
  }

  public addSpeaker(name: string, source: DiscoveredSpeaker['source'] = 'manual', confidence = 1.0) {
    const cleaned = cleanSpeakerName(name);
    if (!cleaned) return;

    if (!this.discoveredSpeakers.has(cleaned)) {
      this.discoveredSpeakers.set(cleaned, {
        name: cleaned,
        source,
        confidence,
        firstSeen: Date.now(),
        lastActive: Date.now(),
      });
      this.notifyListeners();
    }
  }

  public setActiveSpeaker(name: string) {
    const cleaned = cleanSpeakerName(name) || name;
    this.activeSpeaker = cleaned;
    this.notifyListeners();
  }

  public getActiveSpeaker(): string | null {
    return this.activeSpeaker;
  }

  /**
   * Returns the real name of the local user (the person marked as "(You)" in the meeting app).
   * Used to replace "You / Host" with the actual name in the transcript.
   */
  public getSelfName(): string | null {
    return this.selfName;
  }

  public setSelfName(name: string): void {
    const cleaned = cleanSpeakerName(name);
    if (cleaned && cleaned !== this.selfName) {
      this.selfName = cleaned;
      if (this.discoveredSpeakers.has(cleaned)) {
        this.discoveredSpeakers.get(cleaned)!.isSelf = true;
      }
      this.notifyListeners();
    }
  }

  public getDiscoveredSpeakers(): string[] {
    return Array.from(this.discoveredSpeakers.keys());
  }

  public getDetectedApp(): string | null {
    return this.detectedApp;
  }

  public subscribe(
    callback: (roster: string[], app: string | null, activeSpeaker: string | null, selfName: string | null) => void
  ): () => void {
    this.listeners.add(callback as any);
    // Initial emit
    callback(this.getDiscoveredSpeakers(), this.detectedApp, this.activeSpeaker, this.selfName);

    return () => {
      this.listeners.delete(callback as any);
    };
  }

  private notifyListeners() {
    const roster = this.getDiscoveredSpeakers();
    for (const listener of this.listeners) {
      try {
        (listener as any)(roster, this.detectedApp, this.activeSpeaker, this.selfName);
      } catch (e) {
        console.warn('[HuskyNote SpeakerHook] Listener error:', e);
      }
    }
  }
}

export const speakerHookManager = MeetingSpeakerHook.getInstance();
