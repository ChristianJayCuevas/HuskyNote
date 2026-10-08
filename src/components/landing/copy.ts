/**
 * Every visible string on the landing page, in English. Components read these
 * through useLandingCopy(), which looks each leaf up as `home.<path>` in the
 * locale files and falls back to the value here.
 */
export const LANDING_COPY = {
  skip: 'Skip to content',
  nav: {
    label: 'Main',
    home: 'HuskyNote, back to top',
    features: 'Features',
    privacy: 'Privacy',
    faq: 'FAQ',
    download: 'Download',
    openApp: 'Open HuskyNote',
    downloadCta: 'Download',
    toDark: 'Switch to dark theme',
    toLight: 'Switch to light theme',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    github: 'HuskyNote on GitHub',
  },
  hero: {
    whatsNew: "What's new",
    titleStart: 'Sit.',
    titleMark: 'Stay.',
    titleEnd: 'Take notes.',
    sub: 'HuskyNote records and transcribes your meetings, answers questions about your PDFs, and turns screen recordings into step-by-step guides. Everything is saved on your computer. No account, no cloud sync.',
    openApp: 'Open HuskyNote',
    getDesktop: 'Get the desktop app',
    downloadWindows: 'Download for Windows',
    downloadMacos: 'Download for macOS',
    downloadLinux: 'Download for Linux',
    downloadAny: 'Download HuskyNote',
    howItWorks: 'How it works',
    note: 'Free · MIT licensed · Windows, macOS, and Linux',
    caption: 'Example meeting. Transcribed on the device; report written by the AI you choose.',
  },
  mock: {
    breadcrumbSection: 'Meetings',
    meetingTitle: 'Weekly planning',
    recording: 'Recording',
    writing: 'Writing report…',
    saved: 'Saved on this device',
    nav: ['Home', 'Notes', 'Meetings', 'Documents', 'Guides', 'Schedule'],
    profile: 'Work',
    engine: 'Parakeet · WebGPU',
    language: 'English',
    you: 'You',
    speaker2: 'Speaker 2',
    lines: [
      'Quick one today: the launch review and the checklist.',
      'Thursday works better for the review than Tuesday.',
      'Okay, Thursday it is. Can you send the checklist draft?',
      "Yes, I'll have it to you by Wednesday.",
    ],
    reportTitle: 'Meeting report',
    reportBy: 'Written by Ollama · llama3.2',
    summaryLabel: 'Summary',
    summary: 'Moved the launch review to Thursday. Checklist draft due Wednesday.',
    decisionLabel: 'Decision',
    decision: 'Launch review moves to Thursday.',
    actionLabel: 'Action item',
    action: 'Send the checklist draft',
    actionMeta: 'Speaker 2 · Wed',
  },
  facts: {
    label: 'At a glance',
    items: [
      { title: 'No account', body: "Open it and start. There's nothing to sign up for." },
      { title: 'Transcribes on your device', body: 'Parakeet and Whisper run inside the app, on your GPU when available.' },
      { title: 'Your choice of AI', body: 'Local models through Ollama, or Claude with your own API key.' },
      { title: 'Free and MIT licensed', body: 'Desktop apps for Windows, macOS, and Linux.' },
    ],
  },
  features: {
    eyebrow: 'What it does',
    title: 'Four jobs, done on your computer.',
    lede: 'Use one or all four. They share the same search, profiles, and backups.',
    meetings: {
      label: 'Meetings',
      title: 'Record the meeting. Get the write-up.',
      body: 'Record from your microphone and watch the transcript appear as people talk. When you stop, HuskyNote drafts a report with the summary, decisions, and action items.',
      bullets: [
        'Parakeet, Whisper, or Moonshine, running on your device',
        'English, Filipino and Taglish, or mixed-language meetings',
        'Export reports as PDF or Markdown',
      ],
      extension: 'Using Google Meet? Try the Chrome extension',
    },
    documents: {
      label: 'Documents',
      title: 'Ask your PDFs. Get the page number.',
      body: 'Open a PDF, highlight what matters, and ask questions in plain language. Answers point you to the page they came from, so you can check them.',
      bullets: [
        'Highlights, notes, and boxes stay on the page',
        'Turn a section into numbered steps',
        'Also opens Word, PowerPoint, text, and Markdown files',
      ],
    },
    guides: {
      label: 'Guides',
      title: 'Show it once. Get a step-by-step guide.',
      body: 'Record your screen while you do a task. HuskyNote captures the steps and screenshots, then builds a guide you can edit and share.',
      bullets: ['Reorder steps, add warnings and tips', 'Screenshots marked with where to click', 'Export to PDF, Markdown, or HTML'],
    },
    notes: {
      label: 'Notes and schedule',
      title: 'Notes, schedule, and separate profiles.',
      body: 'Write in Markdown with version history, keep a simple schedule, and use profiles to keep work, school, and personal notes apart.',
      bullets: [
        'Search across notes, meetings, and documents',
        'Templates for meeting notes, decisions, and more',
        'Back up everything to one file and restore it anywhere',
      ],
    },
  },
  mocks: {
    meetings: {
      status: 'Recording · 08:12',
      engines: ['Parakeet', 'Whisper', 'Moonshine'],
      lineA: 'Let’s keep the demo short and show the export.',
      lineB: 'Agreed. I’ll prepare the sample report.',
      export: 'Export',
      pdf: 'PDF',
      markdown: 'Markdown',
    },
    documents: {
      file: 'Product handbook.pdf',
      page: 'Page 4 of 12',
      question: 'How long is the return window?',
      answer: '30 days from delivery.',
      cite: 'Page 4',
    },
    guides: {
      dialogTitle: 'Export meeting',
      cancel: 'Cancel',
      export: 'Export',
      steps: ['Open the meeting', 'Click Export', 'Choose PDF and save'],
      title: 'Export a meeting report',
      count: '3 steps',
    },
    notes: {
      heading: '## Offsite ideas',
      itemA: '- Morning hike',
      itemB: '- Board games',
      saved: 'Saved · 3 versions',
      scheduleTime: 'Thu 10:00',
      scheduleTitle: 'Follow-up call',
      scheduleHint: 'Suggested from a meeting',
      profiles: ['Work', 'Personal', 'Study'],
    },
  },
  ai: {
    eyebrow: 'Your AI, your call',
    title: 'Local AI, or your own Claude key.',
    lede: "HuskyNote doesn't run AI servers or sell credits. You decide where the thinking happens, and you can switch anytime in Settings.",
    local: {
      title: 'Local with Ollama',
      body: 'Models run on your computer, so your notes and recordings stay on it. Works offline once a model is downloaded.',
      tags: ['Free', 'Offline', 'llama3.2, qwen2.5, gemma, and more'],
    },
    claude: {
      title: 'Claude with your API key',
      body: "Use Anthropic's Claude models with a key you control. Only the content you attach to a request is sent to Anthropic.",
      tags: ['Your key', 'Your bill', 'Off by default'],
    },
    footnote: 'No AI set up yet? Recording, transcription, notes, and reading documents still work.',
  },
  privacy: {
    eyebrow: 'Local-first',
    title: 'Your work stays on your device.',
    lede: "Recordings, transcripts, notes, and documents live in the app's local database on your computer. There are no HuskyNote accounts and no HuskyNote cloud.",
    computer: 'Your computer',
    tiles: ['Recordings', 'Transcripts', 'Notes', 'Documents', 'Guides', 'Speech models'],
    services: [
      { name: 'Hugging Face', detail: 'Speech model download, first setup only' },
      { name: 'Anthropic', detail: 'Only if you choose Claude' },
      { name: 'Google Calendar', detail: 'Only if you connect it' },
    ],
    goodToKnow: 'Good to know',
    notes: [
      "The first time you set up transcription, the speech model downloads from Hugging Face. After that it's cached on your device.",
      'If you choose Claude, the content you attach is sent to Anthropic with your API key.',
      'Google Calendar and update checks stay off until you turn them on.',
      'Export a .huskybackup file anytime and restore it on another computer.',
    ],
    details: 'Read the privacy details',
  },
  how: {
    eyebrow: 'Getting started',
    title: 'Up and running in three steps.',
    step: 'Step',
    steps: [
      { title: 'Install the app', body: 'Download HuskyNote for Windows, macOS, or Linux and open it. No sign-up.' },
      { title: 'Set up transcription', body: 'Pick an engine in Settings. The model downloads once, then runs on your device.' },
      { title: 'Record, read, ask', body: 'Start a meeting, open a PDF, or record a guide. Add Ollama or a Claude key whenever you want AI reports.' },
    ],
  },
  faq: {
    eyebrow: 'Questions',
    title: 'Good questions.',
    items: [
      { q: 'Is it really free?', a: 'Yes. HuskyNote is free and MIT licensed. If you use Claude, Anthropic bills your API key directly.' },
      {
        q: 'Does it work offline?',
        a: 'Yes, after setup. You need internet to download the app and the speech model the first time. With local AI through Ollama, reports work offline too.',
      },
      {
        q: 'Do I need Ollama or an API key?',
        a: 'No. Recording, transcription, notes, and reading documents work without AI. Add Ollama or a Claude key when you want reports and answers.',
      },
      {
        q: 'Where is my data stored?',
        a: "In the app's local database on your computer. Each profile keeps its own data, and you can export a backup file at any time.",
      },
      {
        q: 'Which languages can it transcribe?',
        a: 'Parakeet handles English. Whisper handles English, Filipino and Taglish, and mixed-language meetings.',
      },
    ],
  },
  download: {
    eyebrow: 'Download',
    title: 'Good notes, kept close.',
    lede: "HuskyNote v{version} is free for Windows, macOS, and Linux. Builds aren't code-signed yet, so your system may ask you to confirm the first launch.",
    yourSystem: 'Your system',
    windows: { name: 'Windows', detail: 'Installer (.exe) or portable (.zip)', button: 'Windows downloads' },
    macos: {
      name: 'macOS',
      detail: 'Disk image (.dmg) for Apple silicon, Intel, or Universal',
      note: "macOS may block the first launch because the app isn't notarized yet. The download page explains how to open it.",
      button: 'macOS downloads',
    },
    linux: { name: 'Linux', detail: 'AppImage or portable .tar.gz', button: 'Linux downloads' },
    source: 'Prefer to run it from source? See the README on GitHub',
  },
  footer: {
    tagline: 'A local-first AI secretary for meetings, documents, and notes.',
    product: 'Product',
    project: 'Project',
    download: 'Download',
    whatsNew: "What's new",
    privacy: 'Privacy',
    github: 'GitHub',
    about: 'About and credits',
    extension: 'Chrome extension',
    legal: 'MIT License · © 2026 HuskyNote contributors',
  },
};

export type LandingCopy = typeof LANDING_COPY;

type Translate = (path: string, fallback: string) => string;

/** Returns a copy of the tree with every string leaf passed through `translate(path, value)`. */
export function mapCopy<T>(node: T, translate: Translate, path = 'home'): T {
  if (typeof node === 'string') return translate(path, node) as T;
  if (Array.isArray(node)) return node.map((item, i) => mapCopy(item, translate, `${path}.${i}`)) as T;
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) out[key] = mapCopy(value, translate, `${path}.${key}`);
    return out as T;
  }
  return node;
}

/** Every string leaf of the copy tree as [path, value] pairs. */
export function flattenCopy(node: unknown = LANDING_COPY, path = 'home'): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  mapCopy(node, (p, value) => {
    out.push([p, value]);
    return value;
  }, path);
  return out;
}
