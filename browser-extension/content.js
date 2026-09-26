// HuskyNote Content Script — In-Page Meeting HUD
// ─────────────────────────────────────────────
// Fully local, zero external API.
// • Detects Google Meet / Zoom / Teams participant name chips from the DOM
// • Runs Web Speech API for real-time transcription
// • Assigns speaker names from DOM participant tiles
// • On stop: sends to local Ollama (localhost:11434) for full meeting documentation

(function () {
  if (window.__huskynote_injected) return;
  window.__huskynote_injected = true;

  // ─── Extension connection marker ───────────────────────────────────────────
  const marker = document.createElement('div');
  marker.id = 'huskynote-extension-marker';
  marker.style.display = 'none';
  document.documentElement.appendChild(marker);

  // Respond to pings from HuskyNote web app
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'HUSKYNOTE_PING') {
      window.postMessage({ type: 'HUSKYNOTE_PONG', source: 'huskynote-extension', version: '2.0.0' }, '*');
    }
  });

  // ─── Constants ─────────────────────────────────────────────────────────────
  const OLLAMA_URL = 'http://localhost:11434/api/generate';
  const DEFAULT_MODEL = 'llama3.2';
  const HUD_ID = 'husky-meeting-hud';

  // ─── State ──────────────────────────────────────────────────────────────────
  let isRecording = false;
  let isPaused = false;
  let startTime = 0;
  let elapsedTimer = null;
  let transcript = []; // { id, timestampSeconds, speaker, text }
  let segCounter = 0;
  let recognition = null;
  let currentInterim = '';
  let participantRotationIndex = 0;
  let speakerPool = [];         // live participant names from DOM
  let speakerHistory = {};      // Maps phrase fingerprint → speaker guess
  let lastSpeakerIndex = 0;
  let bookmarks = [];           // { timestampSeconds, type, note }
  let quickNotes = [];          // { timestampSeconds, text }
  let isGenerating = false;
  let currentDrawer = null;     // 'transcript' | 'report' | null

  // ─── Helpers ───────────────────────────────────────────────────────────────
  function fmt(s) {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  }

  function uid() {
    return `husky-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  }

  // Relay messages from background script or storage to web page
  if (typeof chrome !== 'undefined') {
    if (chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === 'HUSKYNOTE_MEETING_PARTICIPANTS' || msg.type === 'HUSKYNOTE_ACTIVE_SPEAKER') {
          window.postMessage(msg, '*');
        }
      });
    }

    if (chrome.storage?.local) {
      chrome.storage.local.get(['husky_live_meeting_roster'], (res) => {
        if (res.husky_live_meeting_roster) {
          window.postMessage({
            type: 'HUSKYNOTE_MEETING_PARTICIPANTS',
            ...res.husky_live_meeting_roster,
          }, '*');
        }
      });

      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.husky_live_meeting_roster?.newValue) {
          window.postMessage({
            type: 'HUSKYNOTE_MEETING_PARTICIPANTS',
            ...changes.husky_live_meeting_roster.newValue,
          }, '*');
        }
      });
    }
  }

  // ─── Multi-App Participant & Active Speaker Hook ───────────────────────────
  function detectCurrentMeetingApp() {
    const host = window.location.hostname.toLowerCase();
    if (host.includes('meet.google.com')) return 'Google Meet';
    if (host.includes('teams.microsoft.com') || host.includes('teams.live.com')) return 'Microsoft Teams';
    if (host.includes('zoom.us')) return 'Zoom';
    if (host.includes('webex.com')) return 'Cisco Webex';
    if (host.includes('slack.com')) return 'Slack Huddle';
    if (host.includes('discord.com')) return 'Discord';
    if (host.includes('meet.jit.si') || host.includes('8x8.vc')) return 'Jitsi Meet';
    if (host.includes('skype.com')) return 'Skype';
    return null;
  }

  function cleanParticipantName(raw) {
    if (!raw || typeof raw !== 'string') return null;
    let name = raw
      .replace(/\s*\((?:you|host|co-host|guest|external|presenter|organiser|organizer|presentation|joined|leaving)\)/gi, '')
      .replace(/\s*\(\d+\)$/, '')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/^[^a-zA-Z0-9\u3040-\u30FF\u4E00-\u9FAF]+|[^a-zA-Z0-9\u3040-\u30FF\u4E00-\u9FAF]+$/g, '')
      .trim();

    if (name.length < 2 || name.length > 50) return null;
    if (/^(?:speaker|participant|user|guest)\s*\d*$/i.test(name)) return null;
    if (/^\d+([:.]\d+)?$/.test(name)) return null;

    const UI_IGNORE = new Set([
      'mute', 'unmute', 'turn off microphone', 'turn off camera', 'raise hand', 'lower hand',
      'leave call', 'leave meeting', 'end call', 'participants', 'people', 'chat', 'more options',
      'show more', 'pin to screen', 'unpin', 'settings', 'share screen', 'present now',
      'whiteboard', 'breakout rooms', 'captions', 'audio', 'video', 'search', 'close',
      'turn on microphone', 'turn on camera', 'meeting host', 'all muted', 'add people',
      'search for people', 'in the meeting', 'contributors', 'track attendance', 'stop sharing',
      'sharing this tab', 'meeting details', 'info'
    ]);
    if (UI_IGNORE.has(name.toLowerCase())) return null;

    // Title case format so lowercase names become capitalized (e.g. "german" -> "German")
    name = name
      .split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    return name;
  }

  let domActiveSpeaker = null;
  let lastActiveSpeakerTimestamp = 0;

  function scrapeActiveSpeaker() {
    const app = detectCurrentMeetingApp();

    // 1. Google Meet: active speaking ring/pulse or data-is-speaking
    if (app === 'Google Meet') {
      // Check data-is-speaking tiles first
      const speakingTile = document.querySelector('[data-is-speaking="true"], [data-active-speaker="true"], .oJeWuf');
      if (speakingTile) {
        const nameEl = speakingTile.querySelector('[data-self-name], .zWGUib, .NMhWlb, .nxzRjb, [jsname="A7TdRd"], [dir="auto"]');
        const name = cleanParticipantName(nameEl?.textContent || speakingTile.getAttribute('aria-label') || '');
        if (name) return name;
      }
      // Live caption author — the person speaking is usually shown next to captions
      const captionAuthor = document.querySelector('.iTTPOb .TBMuR, div[jsname="ysnEbe"] .TBMuR, [jsname="tgaKEf"] .TBMuR, .a4cQT .TBMuR');
      if (captionAuthor) {
        const name = cleanParticipantName(captionAuthor.textContent || '');
        if (name) return name;
      }
      // Large tile / dominant speaker label (the big tile at center screen)
      const dominantTile = document.querySelector('[data-call-layout-mode] [data-allocation-index="0"] [dir="auto"], [jsname="Vd3tJb"] [dir="auto"]');
      if (dominantTile) {
        const name = cleanParticipantName(dominantTile.textContent || '');
        if (name) return name;
      }
      // Video tile name label at the bottom-left of the main video
      const videoLabel = document.querySelector('.KF4T6b, .GvcuGe .notranslate, [jsname="EydYod"] .notranslate');
      if (videoLabel) {
        const name = cleanParticipantName(videoLabel.textContent || '');
        if (name) return name;
      }
    }

    // 2. Microsoft Teams: active speaker border / live captions
    if (app === 'Microsoft Teams') {
      const activeEl = document.querySelector('[data-tid="calling-active-speaker"], [aria-label*="speaking"], [aria-label*="is talking"]');
      if (activeEl) {
        const nameEl = activeEl.querySelector('[data-tid="participant-item-name"], [data-tid="roster-avatar-name"]') || activeEl;
        const name = cleanParticipantName(nameEl.textContent || '');
        if (name) return name;
      }
      const captionAuthor = document.querySelector('.ui-chat__item .ui-chat__message__author, [data-tid="closed-caption-text"] .author');
      if (captionAuthor) {
        const name = cleanParticipantName(captionAuthor.textContent || '');
        if (name) return name;
      }
    }

    // 3. Zoom
    if (app === 'Zoom') {
      const activeTile = document.querySelector('.video-avatar__avatar-speaking, [aria-label*="is talking"], [aria-label*="speaking"]');
      if (activeTile) {
        const nameEl = activeTile.querySelector('.video-avatar__avatar-name, .participants-item__name, .video-box__avatar-name') || activeTile;
        const name = cleanParticipantName(nameEl.textContent || '');
        if (name) return name;
      }
      const captionEl = document.querySelector('.closed-caption-text');
      if (captionEl) {
        const m = captionEl.textContent.match(/^([^:]+):/);
        if (m) {
          const name = cleanParticipantName(m[1]);
          if (name) return name;
        }
      }
    }

    // 4. Cisco Webex
    if (app === 'Cisco Webex') {
      const activeEl = document.querySelector('[data-testid="participant-active-speaker"], .roster-item--speaking, .speaking-indicator');
      if (activeEl) {
        const nameEl = activeEl.closest('[data-testid*="participant"]')?.querySelector('[data-testid="participant-display-name"]') || activeEl;
        const name = cleanParticipantName(nameEl.textContent || '');
        if (name) return name;
      }
    }

    // 5. Slack Huddles
    if (app === 'Slack Huddle') {
      const activeEl = document.querySelector('[data-qa="huddle_speaker"], [data-qa="speaking_indicator"], [aria-label*="speaking"]');
      if (activeEl) {
        const nameEl = activeEl.closest('[data-qa="huddle-participant"]')?.querySelector('[data-qa="huddle_member_name"], [data-qa="user_display_name"]') || activeEl;
        const name = cleanParticipantName(nameEl.textContent || '');
        if (name) return name;
      }
    }

    // 6. Discord
    if (app === 'Discord') {
      const activeEl = document.querySelector('.speaking-b2tU14, [class*="avatarSpeaking-"], [class*="speaking-"]');
      if (activeEl) {
        const userEl = activeEl.closest('[class*="voiceUser-"]')?.querySelector('[class*="username-"], [class*="userNick-"]');
        const name = cleanParticipantName(userEl?.textContent || '');
        if (name) return name;
      }
    }

    // 7. Jitsi Meet
    if (app === 'Jitsi Meet') {
      const activeEl = document.querySelector('.dominant-speaker, [id*="dominantSpeaker"]');
      if (activeEl) {
        const nameEl = activeEl.querySelector('.displayname, .presence-label');
        const name = cleanParticipantName(nameEl?.textContent || '');
        if (name) return name;
      }
    }

    return null;
  }

  function scrapeParticipantNames() {
    const names = new Set();

    // Google Meet — comprehensive multi-selector approach
    // 1. All .notranslate elements (video tiles, subtitles, panels)
    document.querySelectorAll('.notranslate, [data-self-name], [data-name], span[jsname], [data-requested-participant-id]').forEach(el => {
      const n = cleanParticipantName(el.textContent);
      if (n) names.add(n);
    });
    // 2. Video tile aria-labels (e.g. "german's video", "Arron Parejas's video")
    document.querySelectorAll('[data-allocation-index], [data-tile-id], [data-participant-id], div[role="region"], div[data-is-speaking]').forEach(el => {
      const label = el.getAttribute('aria-label') || '';
      if (label) {
        const n = cleanParticipantName(label.replace(/\s*(?:'s\s+video|'s\s+screen|'s\s+presentation|is\s+speaking|is\s+muted|has\s+raised\s+hand).*$/i, ''));
        if (n) names.add(n);
      }
    });
    // 3. Name labels on video tiles
    document.querySelectorAll('[data-participant-id] [dir="auto"], [jsname="A7TdRd"], .zWGUib, .NMhWlb, .nxzRjb, .Y5sE8d, .KF4T6b, .GvcuGe .notranslate, [jsname="EydYod"] .notranslate').forEach(el => {
      const n = cleanParticipantName(el.textContent);
      if (n) names.add(n);
    });
    // 4. Google Meet People Sidebar / "Contributors" panel — the key list visible when People panel is open
    // Try multiple selector patterns for the sidebar list items
    const sidebarSelectors = [
      'div[aria-label*="people" i] [role="listitem"]',
      'div[aria-label*="participant" i] [role="listitem"]',
      'div[aria-label*="contributors" i] [role="listitem"]',
      '[jsname="jC1zNd"] [jsname]',   // participants panel internal
      '.VfPpkd-rymPhb-ibnC6b',        // material list items in people panel
      '[data-participant-id]',
    ];
    sidebarSelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        // Try to find the name within the item
        const nameEl = el.querySelector('.notranslate, span[jsname], .zWGUib, [dir="auto"]') || el;
        const n = cleanParticipantName(nameEl.textContent);
        if (n) names.add(n);
        // Also check aria-label of the item itself
        const labelAttr = el.getAttribute('aria-label') || '';
        if (labelAttr) {
          const n2 = cleanParticipantName(labelAttr.replace(/\s*(?:meeting\s+host|host|muted|\(you\)).*$/i, ''));
          if (n2) names.add(n2);
        }
      });
    });
    // 5. Scan ALL elements with aria-label that look like participant names in the meeting list
    // Google Meet renders the people list with items like "Arron Parejas (You) Meeting host"
    document.querySelectorAll('[role="listitem"], [role="option"], [data-participant-id]').forEach(el => {
      const label = (el.getAttribute('aria-label') || '').replace(/\s*(?:meeting\s+host|is\s+muted|\(you\)|\(host\)|\(co-host\)).*$/i, '').trim();
      if (label && label.length >= 2 && label.length <= 50) {
        const n = cleanParticipantName(label);
        if (n) names.add(n);
      }
      // Also scan direct text content of small name sub-elements
      el.querySelectorAll('[dir="auto"], .notranslate, span').forEach(child => {
        const childText = child.textContent?.trim() || '';
        if (childText.length >= 2 && childText.length <= 40 && !childText.includes('\n')) {
          const n = cleanParticipantName(childText);
          if (n) names.add(n);
        }
      });
    });

    // Zoom
    document.querySelectorAll('.video-avatar__avatar-name, .participants-section-container__participant-name, .speaker-bar__title, .video-box__avatar-name, .participants-item__name').forEach(el => {
      const n = cleanParticipantName(el.textContent);
      if (n) names.add(n);
    });

    // Microsoft Teams
    document.querySelectorAll('[data-tid="participant-item-name"], [data-tid="roster-avatar-name"], [data-tid*="participant"]').forEach(el => {
      const n = cleanParticipantName(el.textContent);
      if (n) names.add(n);
    });

    // Cisco Webex
    document.querySelectorAll('[data-testid="participant-display-name"], .participant-name, .roster-item-text').forEach(el => {
      const n = cleanParticipantName(el.textContent);
      if (n) names.add(n);
    });

    // Slack Huddles
    document.querySelectorAll('[data-qa="huddle_member_name"], [data-qa="user_display_name"], .c-huddle-member__name').forEach(el => {
      const n = cleanParticipantName(el.textContent);
      if (n) names.add(n);
    });

    // Discord
    document.querySelectorAll('[class*="username-"], [class*="userNick-"]').forEach(el => {
      const n = cleanParticipantName(el.textContent);
      if (n) names.add(n);
    });

    // Jitsi Meet
    document.querySelectorAll('.displayname, .presence-label, .videocontainer__hover .displayname').forEach(el => {
      const n = cleanParticipantName(el.textContent);
      if (n) names.add(n);
    });

    // Skype Web
    document.querySelectorAll('[data-text-as-pseudo-element], .participant-name').forEach(el => {
      const n = cleanParticipantName(el.textContent);
      if (n) names.add(n);
    });

    // Generic fallback for any video conference tile or aria-label
    document.querySelectorAll('[aria-label*="participant" i], [data-participant], [data-user-name]').forEach(el => {
      const n = cleanParticipantName(el.getAttribute('data-user-name') || el.getAttribute('aria-label') || el.textContent);
      if (n) names.add(n);
    });

    return [...names].filter(n => n.length > 1 && n.length < 50);
  }

  // Persistent BroadcastChannel instance
  let liveBroadcastChannel = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      liveBroadcastChannel = new BroadcastChannel('huskynote_meeting_sync');
    }
  } catch {}

  // Broadcast sync to HuskyNote web app and other tabs
  function broadcastMeetingSync() {
    const app = detectCurrentMeetingApp();
    const participants = scrapeParticipantNames();
    const active = scrapeActiveSpeaker();
    if (active) {
      domActiveSpeaker = active;
      lastActiveSpeakerTimestamp = Date.now();
    }

    // ─── Identify the local user (the "(You)" participant) ───────────────────
    // Google Meet marks the local user with "(You)" in various places.
    // We detect this BEFORE cleaning the name so we don't lose the marker.
    let selfParticipant = null;
    const selfSelectors = [
      // People sidebar list items — aria-label contains "(You)"
      '[role="listitem"]',
      '[role="option"]',
      '[data-participant-id]',
      '.VfPpkd-rymPhb-ibnC6b',
    ];
    outer: for (const sel of selfSelectors) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        const rawText = (el.textContent || '').trim();
        const ariaLabel = (el.getAttribute('aria-label') || '').trim();
        const combined = ariaLabel || rawText;
        if (/\(you\)/i.test(combined)) {
          // Extract name: everything before "(You)" or role labels
          const raw = combined
            .replace(/\s*\(you\).*/i, '')
            .replace(/\s*(?:meeting\s+host|is\s+muted|co-host|host).*$/i, '')
            .trim();
          const cleaned = cleanParticipantName(raw);
          if (cleaned) {
            selfParticipant = cleaned;
            break outer;
          }
        }
      }
    }

    // Fallback: look for data-self-name or [is-self] attribute
    if (!selfParticipant) {
      const selfEl = document.querySelector('[data-self-name], [is-self="true"], .JBnKlb [dir="auto"]');
      if (selfEl) {
        const raw = (selfEl.getAttribute('data-self-name') || selfEl.textContent || '').trim();
        const cleaned = cleanParticipantName(raw);
        if (cleaned) selfParticipant = cleaned;
      }
    }

    const payload = {
      type: 'HUSKYNOTE_MEETING_PARTICIPANTS',
      app: app || 'Meeting',
      participants,
      activeSpeaker: active || domActiveSpeaker || undefined,
      selfParticipant: selfParticipant || undefined,
      timestamp: Date.now(),
    };

    if (liveBroadcastChannel) {
      try {
        liveBroadcastChannel.postMessage(payload);
      } catch {}
    }

    window.postMessage(payload, '*');

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        type: 'HUSKY_MEETING_SYNC',
        data: payload,
      }).catch(() => {});
    }

    // Direct HTTP bridge to HuskyNote local server (ports 5174, 5173, 5175, 8765)
    // Ensures seamless cross-origin participant synchronization
    [5174, 5173, 5175, 8765].forEach((port) => {
      fetch(`http://127.0.0.1:${port}/api/meeting-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'cors',
      }).catch(() => {});
    });
  }

  // Always run sync — even if we don't recognise the app, the extension could be on any page
  // with an open meeting app in another tab. The HTTP bridge posts to HuskyNote regardless.
  setInterval(broadcastMeetingSync, 1500);
  setTimeout(broadcastMeetingSync, 300);

  // ─── MutationObserver: detect participant panel changes instantly ────────────
  // When someone joins/leaves Google Meet, the DOM changes; fire immediately.
  if (detectCurrentMeetingApp()) {
    const observerTarget = document.body || document.documentElement;
    const participantObserver = new MutationObserver(() => {
      // Debounce: don't fire more than once per 600ms
      clearTimeout(participantObserver._timer);
      participantObserver._timer = setTimeout(broadcastMeetingSync, 600);
    });
    participantObserver.observe(observerTarget, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-is-speaking', 'aria-label', 'data-participant-id'] });
  }

  // ─── Smart speaker assignment ───────────────────────────────────────────────
  // Dynamically uses active speaker DOM hooks, conversational self-introductions,
  // and multi-participant roster, NEVER defaulting to "Speaker 1" or "Speaker 2".
  function assignSpeaker(text) {
    const discovered = scrapeParticipantNames();
    if (discovered.length > 0) {
      speakerPool = discovered;
    }

    // 1. Live Active Speaker Hook from DOM (highest priority)
    const active = scrapeActiveSpeaker();
    if (active) {
      domActiveSpeaker = active;
      lastActiveSpeakerTimestamp = Date.now();
      if (!speakerPool.includes(active)) speakerPool.push(active);
      return active;
    }
    if (domActiveSpeaker && (Date.now() - lastActiveSpeakerTimestamp < 4500)) {
      return domActiveSpeaker;
    }

    // 2. Conversational self-introduction detection in speech
    const selfIntroMatch =
      text.match(/(?:hi|hello|hey|good\s+(?:morning|afternoon))(?:\s+(?:everyone|all|team))?[,\s]+(?:this\s+is|it'?s|i'?m|my\s+name\s+is)\s+([A-Z][a-zA-Z'\-]+(?:\s+[A-Z][a-zA-Z'\-]+)?)/i) ||
      text.match(/^([A-Z][a-zA-Z'\-]+(?:\s+[A-Z][a-zA-Z'\-]+)?)\s+(?:here|speaking)\b/i) ||
      text.match(/\b(?:ako\s+nga\s+pala\s+si|si)\s+([A-Z][a-zA-Z'\-]+)\s+(?:ito|dito)\b/i);

    if (selfIntroMatch && selfIntroMatch[1]) {
      const candidate = cleanParticipantName(selfIntroMatch[1]);
      if (candidate) {
        domActiveSpeaker = candidate;
        lastActiveSpeakerTimestamp = Date.now();
        if (!speakerPool.includes(candidate)) speakerPool.push(candidate);
        return candidate;
      }
    }

    // 3. If no speaker pool is found yet, use "You / Host" rather than generic "Speaker 1"
    if (speakerPool.length === 0) {
      return 'You / Host';
    }

    // 4. Natural conversational flow among discovered real participants
    if (transcript.length > 0) {
      const last = transcript[transcript.length - 1];
      if (last.text.endsWith('?') && text.length < 60) {
        lastSpeakerIndex = (lastSpeakerIndex + 1) % speakerPool.length;
      } else if (text.length > 80) {
        const lastThree = transcript.slice(-3);
        const sameCount = lastThree.filter(s => s.speaker === speakerPool[lastSpeakerIndex]).length;
        if (sameCount >= 3) lastSpeakerIndex = (lastSpeakerIndex + 1) % speakerPool.length;
      }
    }

    return speakerPool[lastSpeakerIndex] || speakerPool[0] || 'You / Host';
  }

  // ─── Speech Recognition ────────────────────────────────────────────────────
  function startRecognition(onSegment, onInterim) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      console.warn('[HuskyNote] Web Speech API not supported in this browser.');
      return null;
    }

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || 'en-US';

    rec.onresult = (event) => {
      let interim = '';
      const elapsed = Math.max(0, Math.floor((Date.now() - startTime) / 1000));

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const text = res[0]?.transcript?.trim();
        if (!text) continue;

        if (res.isFinal) {
          const speaker = assignSpeaker(text);
          onSegment({
            id: uid(),
            timestampSeconds: elapsed,
            speaker,
            text,
          });
        } else {
          interim += (interim ? ' ' : '') + text;
        }
      }
      onInterim(interim);
    };

    rec.onerror = (e) => {
      if (e.error === 'not-allowed') {
        showHUDToast('Microphone permission denied', true);
      }
    };

    let restarts = 0;
    rec.onend = () => {
      if (isRecording && !isPaused && restarts < 60) {
        restarts++;
        setTimeout(() => { try { rec.start(); } catch {} }, Math.min(200 * restarts, 3000));
      }
    };

    try { rec.start(); } catch {}
    return rec;
  }

  // ─── Ollama AI Documentation Generator ─────────────────────────────────────
  async function generateMeetingDoc(onChunk) {
    const participants = [...new Set(transcript.map(s => s.speaker))];
    const transcriptText = transcript
      .map(s => `[${fmt(s.timestampSeconds)}] ${s.speaker}: ${s.text}`)
      .join('\n');
    const bookmarkText = bookmarks
      .map(b => `[${fmt(b.timestampSeconds)}] [${b.type.toUpperCase()}] ${b.note || ''}`)
      .join('\n');
    const notesText = quickNotes
      .map(n => `[${fmt(n.timestampSeconds)}] ${n.text}`)
      .join('\n');

    const prompt = `You are an expert meeting documentation specialist. Analyze this complete meeting transcript and generate a comprehensive, professional meeting document.

MEETING PARTICIPANTS: ${participants.join(', ')}
DURATION: ${fmt(Math.floor((Date.now() - startTime) / 1000))}
DATE: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

FULL TRANSCRIPT:
${transcriptText || '(no verbal transcript captured)'}

BOOKMARKED MOMENTS:
${bookmarkText || '(none)'}

QUICK NOTES:
${notesText || '(none)'}

Generate a FULL meeting document in clean Markdown with these EXACT sections:

# Meeting Minutes — [Meeting Title inferred from discussion]

**Date:** [today's date]
**Duration:** [total time]
**Participants:** [list each speaker with role if inferable]

---

## Executive Summary
[2-3 sentence overview of what was accomplished]

## Agenda Topics Discussed
[Bullet list of main topics covered, with timestamps]

## Per-Speaker Contributions
[For EACH participant, summarize their key points, positions, and contributions in 3-5 bullet points]

## Key Decisions Made
[Numbered list of all decisions reached, with who decided and rationale]

## Action Items
| # | Task | Assigned To | Due | Priority |
|---|------|------------|-----|----------|
[Fill table with all action items extracted]

## Open Questions & Blockers
[Unresolved items that need follow-up]

## Follow-Up Meeting
[If a next meeting was discussed, include date/time/agenda]

## Full Transcript (Speaker-Tagged)
[Reproduce the full transcript formatted as clean dialogue with speaker labels]

---
*Generated locally by HuskyNote AI — 100% private, no data leaves your device.*`;

    try {
      // Try streaming first
      const res = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          prompt,
          stream: true,
          options: { temperature: 0.15, num_predict: 4096 },
        }),
      });

      if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullDoc = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.trim());
        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            if (json.response) {
              fullDoc += json.response;
              onChunk(json.response, fullDoc);
            }
          } catch {}
        }
      }
      return fullDoc;
    } catch (err) {
      console.error('[HuskyNote] Ollama error:', err);
      // Graceful fallback: structured local doc
      const fallback = buildFallbackDoc(participants, transcriptText, bookmarkText, notesText);
      onChunk('', fallback);
      return fallback;
    }
  }

  function buildFallbackDoc(participants, transcriptText, bookmarkText, notesText) {
    const now = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    return `# Meeting Minutes

**Date:** ${now}
**Duration:** ${fmt(Math.floor((Date.now() - startTime) / 1000))}
**Participants:** ${participants.join(', ')}

> Local Ollama AI unavailable. Showing raw transcript — start Ollama for full AI documentation.

---

## Transcript

${transcriptText || '(No transcript captured)'}

## Bookmarks

${bookmarkText || '(None)'}

## Notes

${notesText || '(None)'}

---
*Generated by HuskyNote — 100% private, local-first.*`;
  }

  // ─── HUD Styles ─────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('husky-hud-styles')) return;
    const style = document.createElement('style');
    style.id = 'husky-hud-styles';
    style.textContent = `
      #${HUD_ID} * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      #${HUD_ID} { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); z-index: 2147483647; user-select: none; display: flex; flex-direction: column; align-items: center; gap: 8px; }
      
      .husky-bar {
        display: flex; align-items: center; gap: 6px; padding: 7px 10px; border-radius: 16px;
        background: rgba(10, 10, 14, 0.92); border: 1px solid rgba(255,255,255,0.18);
        box-shadow: 0 20px 50px -10px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.08);
        backdrop-filter: blur(24px) saturate(180%); -webkit-backdrop-filter: blur(24px) saturate(180%);
        cursor: grab; white-space: nowrap;
      }
      .husky-bar:active { cursor: grabbing; }
      
      .husky-grip { color: rgba(255,255,255,0.3); padding: 0 4px; font-size: 14px; cursor: grab; }
      
      .husky-status {
        display: flex; align-items: center; gap: 8px; padding: 5px 10px;
        background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
        border-radius: 10px;
      }
      .husky-dot { width: 9px; height: 9px; border-radius: 50%; background: white; position: relative; flex-shrink: 0; }
      .husky-dot.paused { background: #71717a; }
      .husky-dot.pulse::after {
        content: ''; position: absolute; inset: -4px; border-radius: 50%;
        border: 1px solid rgba(255,255,255,0.5); animation: husky-ping 1.4s infinite;
      }
      @keyframes husky-ping { 0% { transform: scale(1); opacity: 0.8; } 100% { transform: scale(2.2); opacity: 0; } }
      
      .husky-timer { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px; font-weight: 700; color: white; letter-spacing: 0.5px; }
      .husky-status-text { font-size: 9px; color: #71717a; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
      
      .husky-waves { display: flex; align-items: flex-end; gap: 2px; height: 14px; }
      .husky-wave-bar { width: 2px; background: #e4e4e7; border-radius: 1px; transition: height 80ms ease; }
      
      .husky-div { width: 1px; height: 20px; background: rgba(255,255,255,0.12); }
      
      .husky-btn {
        display: flex; align-items: center; gap: 5px; padding: 6px 10px; border-radius: 10px;
        border: 1px solid transparent; background: transparent; color: #d4d4d8; font-size: 11px;
        font-weight: 600; cursor: pointer; transition: all 0.15s ease; white-space: nowrap;
      }
      .husky-btn:hover { background: rgba(255,255,255,0.12); color: white; }
      .husky-btn:active { transform: scale(0.95); }
      .husky-btn.active { background: rgba(255,255,255,0.2); border-color: rgba(255,255,255,0.3); color: white; }
      .husky-btn.primary { background: white; color: black; border-color: white; }
      .husky-btn.primary:hover { background: #e4e4e7; }
      .husky-btn.danger { background: rgba(239,68,68,0.15); border-color: rgba(239,68,68,0.4); color: #fca5a5; }
      .husky-btn.danger:hover { background: rgba(239,68,68,0.25); color: #fecaca; }
      .husky-btn svg { width: 13px; height: 13px; flex-shrink: 0; }
      .husky-badge { font-size: 9px; font-weight: 700; font-family: monospace; padding: 1px 5px; background: rgba(255,255,255,0.2); border-radius: 4px; color: white; }
      
      /* Drawer */
      .husky-drawer {
        width: 400px; max-width: 95vw; border-radius: 16px; padding: 14px;
        background: rgba(10, 10, 14, 0.95); border: 1px solid rgba(255,255,255,0.18);
        box-shadow: 0 24px 60px -12px rgba(0,0,0,0.9); backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px); overflow: hidden;
        animation: husky-fade-in 0.2s ease;
      }
      @keyframes husky-fade-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
      .husky-drawer-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); }
      .husky-drawer-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: white; display: flex; align-items: center; gap: 6px; }
      .husky-close-btn { padding: 4px; border-radius: 6px; border: none; background: transparent; color: #71717a; cursor: pointer; display: flex; }
      .husky-close-btn:hover { background: rgba(255,255,255,0.1); color: white; }
      
      .husky-transcript-list { max-height: 240px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
      .husky-transcript-list::-webkit-scrollbar { width: 4px; }
      .husky-transcript-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
      .husky-seg { padding: 8px 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; }
      .husky-seg-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px; }
      .husky-speaker { font-size: 10px; font-weight: 700; color: #a1a1aa; }
      .husky-ts { font-family: monospace; font-size: 10px; color: #52525b; }
      .husky-seg-text { font-size: 12px; color: #e4e4e7; line-height: 1.5; }
      .husky-interim { font-size: 11px; color: #52525b; font-style: italic; padding: 4px 0 0 0; }
      
      .husky-report-area { width: 100%; min-height: 200px; max-height: 400px; overflow-y: auto; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 10px; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 11px; color: #d4d4d8; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
      .husky-report-area::-webkit-scrollbar { width: 4px; }
      .husky-report-area::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
      
      .husky-generating { display: flex; align-items: center; gap: 8px; font-size: 11px; color: #a1a1aa; padding: 8px 0; }
      .husky-spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.15); border-top-color: white; border-radius: 50%; animation: husky-spin 0.7s linear infinite; }
      @keyframes husky-spin { to { transform: rotate(360deg); } }
      
      .husky-participants-row { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 10px; }
      .husky-participant-chip { padding: 3px 8px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 20px; font-size: 10px; color: #a1a1aa; font-weight: 600; }
      
      .husky-bookmark-row { display: flex; gap: 6px; margin-bottom: 10px; }
      .husky-bm-btn { flex: 1; padding: 8px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.06); color: white; font-size: 11px; font-weight: 600; cursor: pointer; text-align: center; transition: all 0.15s; }
      .husky-bm-btn:hover { background: rgba(255,255,255,0.15); transform: translateY(-1px); }
      
      .husky-note-form { display: flex; gap: 6px; }
      .husky-note-input { flex: 1; padding: 7px 10px; border-radius: 9px; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.07); color: white; font-size: 11px; outline: none; }
      .husky-note-input:focus { border-color: rgba(255,255,255,0.4); }
      .husky-note-input::placeholder { color: #52525b; }
      
      .husky-action-row { display: flex; align-items: center; gap: 6px; margin-top: 10px; }
      .husky-copy-btn { padding: 5px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15); background: transparent; color: #a1a1aa; font-size: 10px; font-weight: 600; cursor: pointer; }
      .husky-copy-btn:hover { background: rgba(255,255,255,0.1); color: white; }
      
      .husky-toast {
        position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
        z-index: 2147483647; padding: 8px 16px; border-radius: 20px;
        background: rgba(10,10,14,0.95); border: 1px solid rgba(255,255,255,0.2);
        color: white; font-size: 12px; font-weight: 600; white-space: nowrap;
        animation: husky-fade-in 0.2s ease; pointer-events: none;
      }
      .husky-toast.error { border-color: rgba(239,68,68,0.4); color: #fca5a5; }
      
      .husky-speaker-color-0 { color: #93c5fd; } /* blue */
      .husky-speaker-color-1 { color: #86efac; } /* green */
      .husky-speaker-color-2 { color: #fcd34d; } /* yellow */
      .husky-speaker-color-3 { color: #f9a8d4; } /* pink */
      .husky-speaker-color-4 { color: #c4b5fd; } /* violet */
      .husky-speaker-color-5 { color: #6ee7b7; } /* emerald */
    `;
    document.head.appendChild(style);
  }

  // ─── HUD Build ──────────────────────────────────────────────────────────────
  function buildHUD() {
    injectStyles();
    if (document.getElementById(HUD_ID)) return;

    const hud = document.createElement('div');
    hud.id = HUD_ID;
    hud.innerHTML = `
      <!-- Main bar -->
      <div class="husky-bar" id="husky-main-bar">
        <span class="husky-grip" title="Drag to move">⠿</span>

        <!-- Status & timer -->
        <div class="husky-status" id="husky-status-block">
          <span class="husky-dot" id="husky-dot"></span>
          <div>
            <div class="husky-timer" id="husky-timer">00:00</div>
            <div class="husky-status-text" id="husky-status-text">Ready</div>
          </div>
          <div class="husky-waves" id="husky-waves" style="display:none">
            ${[0.4,0.7,0.5,1,0.6,0.8,0.45].map((h,i) => `<div class="husky-wave-bar" id="husky-wb-${i}" style="height:3px"></div>`).join('')}
          </div>
        </div>

        <div class="husky-div"></div>

        <!-- Record / Stop -->
        <button class="husky-btn primary" id="husky-rec-btn" title="Start recording meeting">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="6" fill="currentColor" stroke="none"/></svg>
          Record
        </button>

        <!-- Pause -->
        <button class="husky-btn" id="husky-pause-btn" style="display:none" title="Pause / Resume">
          <svg id="husky-pause-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
        </button>

        <!-- Bookmark -->
        <button class="husky-btn" id="husky-bm-btn" style="display:none" title="Bookmark moment">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
        </button>

        <!-- Transcript drawer -->
        <button class="husky-btn" id="husky-tr-btn" style="display:none" title="Live transcript">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span id="husky-tr-count" class="husky-badge" style="display:none">0</span>
        </button>

        <div class="husky-div" id="husky-stop-div" style="display:none"></div>

        <!-- Stop & Generate -->
        <button class="husky-btn danger" id="husky-stop-btn" style="display:none" title="Stop and generate full meeting document">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
          Stop & Generate Doc
        </button>

        <!-- Close HUD -->
        <button class="husky-btn" id="husky-close-btn" title="Close HuskyNote HUD" style="padding:6px 7px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <!-- Drawer area (injected dynamically) -->
      <div id="husky-drawer-area"></div>
    `;

    document.body.appendChild(hud);
    setupHUDEvents(hud);
  }

  // ─── HUD Events ─────────────────────────────────────────────────────────────
  function setupHUDEvents(hud) {
    // Dragging
    const bar = hud.querySelector('#husky-main-bar');
    let drag = false, ox = 0, oy = 0, sx = 0, sy = 0;

    bar.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      drag = true;
      const rect = hud.getBoundingClientRect();
      ox = e.clientX - rect.left;
      oy = e.clientY - rect.top;
      sx = rect.left;
      sy = rect.top;
      hud.style.transition = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!drag) return;
      const nx = Math.max(0, Math.min(window.innerWidth - hud.offsetWidth, e.clientX - ox));
      const ny = Math.max(0, Math.min(window.innerHeight - 60, e.clientY - oy));
      hud.style.left = nx + 'px';
      hud.style.top = ny + 'px';
      hud.style.transform = 'none';
    });

    document.addEventListener('mouseup', () => { drag = false; });

    // Record button
    hud.querySelector('#husky-rec-btn').addEventListener('click', startMeeting);

    // Pause button
    hud.querySelector('#husky-pause-btn').addEventListener('click', togglePause);

    // Bookmark button
    hud.querySelector('#husky-bm-btn').addEventListener('click', () => openDrawer('bookmark'));

    // Transcript button
    hud.querySelector('#husky-tr-btn').addEventListener('click', () => {
      if (currentDrawer === 'transcript') closeDrawer();
      else openDrawer('transcript');
    });

    // Stop button
    hud.querySelector('#husky-stop-btn').addEventListener('click', stopAndGenerate);

    // Close button
    hud.querySelector('#husky-close-btn').addEventListener('click', () => {
      if (isRecording) {
        if (!confirm('Stop recording and close HuskyNote HUD?')) return;
        stopRecognition();
      }
      hud.remove();
      document.getElementById('husky-hud-styles')?.remove();
      window.__huskynote_injected = false;
    });
  }

  // ─── Recording control ──────────────────────────────────────────────────────
  function startMeeting() {
    if (isRecording) return;
    isRecording = true;
    isPaused = false;
    startTime = Date.now();
    transcript = [];
    bookmarks = [];
    quickNotes = [];
    segCounter = 0;
    lastSpeakerIndex = 0;
    speakerPool = scrapeParticipantNames();

    // Timer
    elapsedTimer = setInterval(() => {
      if (!isPaused) {
        const s = Math.floor((Date.now() - startTime) / 1000);
        const el = document.getElementById('husky-timer');
        if (el) el.textContent = fmt(s);
      }
    }, 1000);

    // Start recognition
    recognition = startRecognition(
      (seg) => {
        transcript.push(seg);
        updateTranscriptCount();
        if (currentDrawer === 'transcript') renderTranscriptDrawer();
      },
      (interim) => {
        currentInterim = interim;
        const iEl = document.getElementById('husky-interim-text');
        if (iEl) iEl.textContent = interim ? `…${interim}` : '';
      }
    );

    // Update UI
    setRecordingUI(true);
    animateWaves();
    showHUDToast('Recording started — speaker names detected from meeting tiles');

    // Re-scan participants every 10s
    setInterval(() => { speakerPool = scrapeParticipantNames(); }, 10000);
  }

  function togglePause() {
    if (!isRecording) return;
    isPaused = !isPaused;
    const btn = document.getElementById('husky-pause-btn');
    const icon = document.getElementById('husky-pause-icon');
    const statusText = document.getElementById('husky-status-text');
    const dot = document.getElementById('husky-dot');

    if (isPaused) {
      recognition?.stop();
      dot?.classList.add('paused');
      dot?.classList.remove('pulse');
      if (statusText) statusText.textContent = 'Paused';
      if (icon) icon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none"/>';
      document.getElementById('husky-waves').style.display = 'none';
    } else {
      recognition = startRecognition(
        (seg) => { transcript.push(seg); updateTranscriptCount(); if (currentDrawer === 'transcript') renderTranscriptDrawer(); },
        (interim) => { currentInterim = interim; const iEl = document.getElementById('husky-interim-text'); if (iEl) iEl.textContent = interim ? `…${interim}` : ''; }
      );
      dot?.classList.remove('paused');
      dot?.classList.add('pulse');
      if (statusText) statusText.textContent = 'Recording';
      if (icon) icon.innerHTML = '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>';
      document.getElementById('husky-waves').style.display = 'flex';
    }
  }

  function stopRecognition() {
    isRecording = false;
    clearInterval(elapsedTimer);
    recognition?.stop();
    recognition = null;
  }

  async function stopAndGenerate() {
    if (!isRecording) return;
    stopRecognition();
    setRecordingUI(false);
    openDrawer('report');
    isGenerating = true;

    const reportArea = document.getElementById('husky-report-area');
    const genRow = document.getElementById('husky-gen-row');
    if (reportArea) reportArea.textContent = '';
    if (genRow) genRow.style.display = 'flex';

    const doc = await generateMeetingDoc((chunk, full) => {
      if (reportArea) {
        reportArea.textContent = full;
        reportArea.scrollTop = reportArea.scrollHeight;
      }
    });

    isGenerating = false;
    if (genRow) genRow.style.display = 'none';

    // Save to extension storage
    const meetingData = {
      id: `meeting-${Date.now()}`,
      title: `Meeting — ${new Date().toLocaleString()}`,
      date: Date.now(),
      durationSeconds: Math.floor((Date.now() - startTime) / 1000),
      participants: [...new Set(transcript.map(s => s.speaker))],
      transcript,
      bookmarks,
      quickNotes,
      document: doc,
    };

    try {
      chrome.storage.local.get(['husky_meetings'], (res) => {
        const meetings = res.husky_meetings || [];
        meetings.unshift(meetingData);
        chrome.storage.local.set({ husky_meetings: meetings.slice(0, 50) });
      });
    } catch {}

    showHUDToast('Meeting document generated and saved');
  }

  // ─── UI helpers ─────────────────────────────────────────────────────────────
  function setRecordingUI(active) {
    const recBtn = document.getElementById('husky-rec-btn');
    const pauseBtn = document.getElementById('husky-pause-btn');
    const bmBtn = document.getElementById('husky-bm-btn');
    const trBtn = document.getElementById('husky-tr-btn');
    const stopBtn = document.getElementById('husky-stop-btn');
    const stopDiv = document.getElementById('husky-stop-div');
    const dot = document.getElementById('husky-dot');
    const statusText = document.getElementById('husky-status-text');
    const waves = document.getElementById('husky-waves');

    if (active) {
      recBtn.style.display = 'none';
      [pauseBtn, bmBtn, trBtn, stopBtn, stopDiv].forEach(el => el && (el.style.display = 'flex'));
      dot?.classList.add('pulse');
      if (statusText) statusText.textContent = 'Recording';
      if (waves) waves.style.display = 'flex';
    } else {
      recBtn.style.display = 'flex';
      [pauseBtn, bmBtn, trBtn, stopBtn, stopDiv].forEach(el => el && (el.style.display = 'none'));
      dot?.classList.remove('pulse', 'paused');
      if (statusText) statusText.textContent = 'Ready';
      if (waves) waves.style.display = 'none';
    }
  }

  function updateTranscriptCount() {
    const badge = document.getElementById('husky-tr-count');
    if (badge) {
      badge.textContent = transcript.length.toString();
      badge.style.display = transcript.length > 0 ? 'inline' : 'none';
    }
  }

  let waveAnimFrame = null;
  function animateWaves() {
    const bars = document.querySelectorAll('.husky-wave-bar');
    const scales = [0.4, 0.7, 0.5, 1, 0.6, 0.8, 0.45];
    function step() {
      if (!isRecording || isPaused) return;
      bars.forEach((bar, i) => {
        const h = Math.max(2, Math.random() * 12 * scales[i]);
        bar.style.height = h + 'px';
      });
      waveAnimFrame = setTimeout(step, 90);
    }
    step();
  }

  // ─── Drawers ────────────────────────────────────────────────────────────────
  function openDrawer(type) {
    currentDrawer = type;
    const area = document.getElementById('husky-drawer-area');
    if (!area) return;

    if (type === 'transcript') {
      area.innerHTML = buildTranscriptDrawer();
      renderTranscriptDrawer();
      area.querySelector('#husky-drawer-close')?.addEventListener('click', closeDrawer);
      const noteForm = area.querySelector('#husky-note-form');
      if (noteForm) {
        noteForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const input = area.querySelector('#husky-note-inp');
          if (!input?.value.trim()) return;
          quickNotes.push({ timestampSeconds: Math.floor((Date.now() - startTime) / 1000), text: input.value.trim() });
          input.value = '';
          showHUDToast('Note saved');
        });
      }
      area.querySelector('#husky-copy-transcript')?.addEventListener('click', () => {
        const text = transcript.map(s => `[${fmt(s.timestampSeconds)}] ${s.speaker}: ${s.text}`).join('\n');
        navigator.clipboard.writeText(text).then(() => showHUDToast('Transcript copied!'));
      });
    } else if (type === 'bookmark') {
      area.innerHTML = buildBookmarkDrawer();
      area.querySelector('#husky-drawer-close')?.addEventListener('click', closeDrawer);
      area.querySelectorAll('.husky-bm-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const btype = btn.dataset.type;
          bookmarks.push({ timestampSeconds: Math.floor((Date.now() - startTime) / 1000), type: btype, note: '' });
          showHUDToast(`${btype.charAt(0).toUpperCase() + btype.slice(1)} bookmarked at ${fmt(Math.floor((Date.now() - startTime) / 1000))}`);
          closeDrawer();
        });
      });
    } else if (type === 'report') {
      area.innerHTML = buildReportDrawer();
      area.querySelector('#husky-drawer-close')?.addEventListener('click', closeDrawer);
      area.querySelector('#husky-copy-report')?.addEventListener('click', () => {
        const text = document.getElementById('husky-report-area')?.textContent || '';
        navigator.clipboard.writeText(text).then(() => showHUDToast('Document copied!'));
      });
    }
  }

  function closeDrawer() {
    currentDrawer = null;
    const area = document.getElementById('husky-drawer-area');
    if (area) area.innerHTML = '';
  }

  function buildTranscriptDrawer() {
    const participants = scrapeParticipantNames();
    return `
      <div class="husky-drawer">
        <div class="husky-drawer-header">
          <div class="husky-drawer-title">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Live Transcript
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            <button class="husky-copy-btn" id="husky-copy-transcript">Copy</button>
            <button class="husky-close-btn" id="husky-drawer-close"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
        </div>
        <div class="husky-participants-row" id="husky-participants-row">
          ${participants.map(p => `<span class="husky-participant-chip">${p}</span>`).join('')}
        </div>
        <div class="husky-transcript-list" id="husky-tr-list">
          <div style="font-size:11px;color:#52525b;text-align:center;padding:16px 0">Listening… transcribed speech will appear here.</div>
        </div>
        <div class="husky-interim" id="husky-interim-text"></div>
        <form class="husky-note-form" id="husky-note-form" style="margin-top:10px">
          <input class="husky-note-input" id="husky-note-inp" placeholder="Quick note (Enter to save)…" autocomplete="off" />
          <button type="submit" class="husky-btn primary" style="padding:6px 10px;border-radius:9px">Save</button>
        </form>
      </div>`;
  }

  function renderTranscriptDrawer() {
    const list = document.getElementById('husky-tr-list');
    if (!list) return;
    if (transcript.length === 0) {
      list.innerHTML = '<div style="font-size:11px;color:#52525b;text-align:center;padding:16px 0">Listening… transcribed speech will appear here.</div>';
      return;
    }
    const speakerNames = [...new Set(transcript.map(s => s.speaker))];
    list.innerHTML = transcript.map(seg => {
      const colorIdx = speakerNames.indexOf(seg.speaker) % 6;
      return `
        <div class="husky-seg">
          <div class="husky-seg-header">
            <span class="husky-speaker husky-speaker-color-${colorIdx}">${seg.speaker}</span>
            <span class="husky-ts">${fmt(seg.timestampSeconds)}</span>
          </div>
          <div class="husky-seg-text">${seg.text}</div>
        </div>`;
    }).join('');
    list.scrollTop = list.scrollHeight;
  }

  function buildBookmarkDrawer() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    return `
      <div class="husky-drawer" style="width:320px">
        <div class="husky-drawer-header">
          <div class="husky-drawer-title">Mark Moment [${fmt(elapsed)}]</div>
          <button class="husky-close-btn" id="husky-drawer-close"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <div class="husky-bookmark-row">
          <button class="husky-bm-btn" data-type="decision">
            <div style="display:flex;justify-content:center;margin-bottom:4px">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            </div>
            <div>Decision</div>
            <div style="font-size:9px;color:#71717a;margin-top:2px">Agreed point</div>
          </button>
          <button class="husky-bm-btn" data-type="action">
            <div style="display:flex;justify-content:center;margin-bottom:4px">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            </div>
            <div>Action Item</div>
            <div style="font-size:9px;color:#71717a;margin-top:2px">Todo / task</div>
          </button>
          <button class="husky-bm-btn" data-type="highlight">
            <div style="display:flex;justify-content:center;margin-bottom:4px">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z"/></svg>
            </div>
            <div>Highlight</div>
            <div style="font-size:9px;color:#71717a;margin-top:2px">Key insight</div>
          </button>
        </div>
      </div>`;
  }

  function buildReportDrawer() {
    return `
      <div class="husky-drawer" style="width:480px">
        <div class="husky-drawer-header">
          <div class="husky-drawer-title">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            AI Meeting Document
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            <button class="husky-copy-btn" id="husky-copy-report">Copy</button>
            <button class="husky-close-btn" id="husky-drawer-close"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
        </div>
        <div class="husky-generating" id="husky-gen-row" style="display:flex">
          <div class="husky-spinner"></div>
          <span>Generating full meeting document with local Ollama AI…</span>
        </div>
        <div class="husky-report-area" id="husky-report-area"></div>
        <div style="margin-top:8px;font-size:10px;color:#52525b">100% local — no data sent anywhere. Powered by Ollama on your device.</div>
      </div>`;
  }

  // ─── Toast ──────────────────────────────────────────────────────────────────
  let toastTimeout = null;
  function showHUDToast(msg, isError = false) {
    let toast = document.getElementById('husky-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'husky-toast';
      toast.className = 'husky-toast' + (isError ? ' error' : '');
      document.body.appendChild(toast);
    }
    toast.className = 'husky-toast' + (isError ? ' error' : '');
    toast.textContent = msg;
    toast.style.display = 'block';
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => { toast.style.display = 'none'; }, 3000);
  }

  // ─── Entry point: inject HUD on Google Meet / Zoom / Teams ─────────────────
  function maybeInjectHUD() {
    const host = window.location.hostname;
    const isMeetingPage =
      host === 'meet.google.com' ||
      host.includes('zoom.us') ||
      host.includes('teams.microsoft.com') ||
      host.includes('meet.jit.si') ||
      window.location.pathname.includes('/meet');

    if (isMeetingPage) {
      setTimeout(buildHUD, 1800); // wait for meeting UI to load
    }
  }

  // On any page: also respond to manual trigger from popup/background
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'HUSKY_OPEN_MEETING_HUD') buildHUD();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', maybeInjectHUD);
  } else {
    maybeInjectHUD();
  }
})();
