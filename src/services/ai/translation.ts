import { ai } from './active-provider';
import type { TranscriptSegment } from '../../types';

export interface SupportedLanguage {
  bcp47: string;        // SpeechRecognition lang code e.g. 'fil-PH'
  code: string;         // ISO 2-letter or 3-letter code e.g. 'fil'
  name: string;         // English display name
  nativeName: string;   // Native display name
  flag: string;         // Emoji flag
  direction?: 'ltr' | 'rtl';
}

/**
 * Supported spoken languages for Web Speech recognition and AI translation.
 */
export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { bcp47: 'auto', code: 'auto', name: 'Auto-Detect Language', nativeName: 'Auto Detect (AI)', flag: '🌐' },
  { bcp47: 'en-US', code: 'en', name: 'English (US)', nativeName: 'English', flag: '🇺🇸' },
  { bcp47: 'fil-PH', code: 'fil', name: 'Filipino / Tagalog', nativeName: 'Wikang Filipino', flag: '🇵🇭' },
  { bcp47: 'ja-JP', code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { bcp47: 'zh-CN', code: 'zh', name: 'Chinese (Mandarin)', nativeName: '中文 (普通话)', flag: '🇨🇳' },
  { bcp47: 'ko-KR', code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { bcp47: 'fr-FR', code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { bcp47: 'es-ES', code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { bcp47: 'de-DE', code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { bcp47: 'it-IT', code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { bcp47: 'pt-BR', code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷' },
  { bcp47: 'ru-RU', code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  { bcp47: 'hi-IN', code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { bcp47: 'id-ID', code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
  { bcp47: 'vi-VN', code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
  { bcp47: 'th-TH', code: 'th', name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭' },
  { bcp47: 'ar-SA', code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', direction: 'rtl' },
];

export interface TranslationTarget {
  code: string;
  name: string;
  flag: string;
  description: string;
}

export const TRANSLATION_TARGETS: TranslationTarget[] = [
  { code: 'none', name: 'Original Only (No Translation)', flag: '🗣️', description: 'Transcribe in spoken language without translating' },
  { code: 'en', name: 'Translate to English (Default)', flag: '🇺🇸', description: 'Translate Filipino, Japanese, Chinese, Korean, French, etc. into English' },
  { code: 'fil', name: 'Translate to Filipino', flag: '🇵🇭', description: 'Translate English, Japanese, Chinese, etc. into Filipino / Tagalog' },
  { code: 'ja', name: 'Translate to Japanese', flag: '🇯🇵', description: 'Translate speech into Japanese (日本語)' },
  { code: 'zh', name: 'Translate to Chinese', flag: '🇨🇳', description: 'Translate speech into Mandarin Chinese (中文)' },
  { code: 'ko', name: 'Translate to Korean', flag: '🇰🇷', description: 'Translate speech into Korean (한국어)' },
  { code: 'fr', name: 'Translate to French', flag: '🇫🇷', description: 'Translate speech into French (Français)' },
  { code: 'es', name: 'Translate to Spanish', flag: '🇪🇸', description: 'Translate speech into Spanish (Español)' },
  { code: 'de', name: 'Translate to German', flag: '🇩🇪', description: 'Translate speech into German (Deutsch)' },
  { code: 'it', name: 'Translate to Italian', flag: '🇮🇹', description: 'Translate speech into Italian (Italiano)' },
  { code: 'pt', name: 'Translate to Portuguese', flag: '🇧🇷', description: 'Translate speech into Portuguese (Português)' },
  { code: 'ru', name: 'Translate to Russian', flag: '🇷🇺', description: 'Translate speech into Russian (Русский)' },
  { code: 'hi', name: 'Translate to Hindi', flag: '🇮🇳', description: 'Translate speech into Hindi (हिन्दी)' },
  { code: 'id', name: 'Translate to Indonesian', flag: '🇮🇩', description: 'Translate speech into Indonesian (Bahasa Indonesia)' },
  { code: 'vi', name: 'Translate to Vietnamese', flag: '🇻🇳', description: 'Translate speech into Vietnamese (Tiếng Việt)' },
  { code: 'th', name: 'Translate to Thai', flag: '🇹🇭', description: 'Translate speech into Thai (ไทย)' },
  { code: 'ar', name: 'Translate to Arabic', flag: '🇸🇦', description: 'Translate speech into Arabic (العربية)' },
];

// In-memory LRU cache to avoid repeated AI calls for identical phrases
const translationCache = new Map<string, string>();
const MAX_CACHE_SIZE = 500;

export function clearTranslationCache(): void {
  translationCache.clear();
}

function getCacheKey(text: string, fromLang: string, toLang: string): string {
  return `${fromLang}->${toLang}:${text.trim().toLowerCase()}`;
}

/**
 * Fast offline dictionary for common meeting phrases across Filipino, Japanese, Chinese, Korean, French.
 * Used as immediate fallback if Local AI is temporarily offline or busy.
 */
const OFFLINE_PHRASE_DICTIONARY: Record<string, Record<string, string>> = {
  // Filipino / Taglish -> English
  'fil->en': {
    'magandang umaga': 'Good morning',
    'magandang umaga po': 'Good morning',
    'magandang hapon': 'Good afternoon',
    'magandang gabi': 'Good evening',
    'salamat': 'Thank you',
    'salamat po': 'Thank you',
    'maraming salamat': 'Thank you very much',
    'maraming salamat po': 'Thank you very much',
    'kamusta': 'How are you',
    'kamusta kayo': 'How are you all',
    'simulan na natin': "Let's get started",
    'simulan na natin ang meeting': "Let's start the meeting",
    'tapusin na natin': "Let's wrap up",
    'bukas': 'tomorrow',
    'mamaya': 'later',
    'ngayon': 'now / today',
    'sa lunes': 'on Monday',
    'sa biyernes': 'on Friday',
    'oo': 'Yes',
    'hindi': 'No',
    'opo': 'Yes (polite)',
    'walang anuman': "You're welcome",
    'ano ang susunod na hakbang': 'What is the next step?',
    'may tanong ba': 'Are there any questions?',
    'clear po': 'Understood / Everything is clear',
  },
  // English -> Filipino
  'en->fil': {
    'good morning': 'Magandang umaga',
    'good afternoon': 'Magandang hapon',
    'good evening': 'Magandang gabi',
    'thank you': 'Maraming salamat',
    'thank you very much': 'Maraming salamat',
    'thanks everyone': 'Maraming salamat sa lahat',
    'lets start': 'Simulan na natin',
    "let's start": 'Simulan na natin',
    "let's get started": 'Simulan na natin',
    'see you tomorrow': 'Magkita tayo bukas',
    'deadline': 'Huling araw / Deadline',
    'next step': 'Susunod na hakbang',
    'action item': 'Gawain / Action item',
    'are there any questions': 'Mayroon bang mga katanungan?',
    'any questions': 'May mga tanong ba?',
    'wrap up': 'Tapusin na natin ang meeting',
  },
  // Japanese -> English
  'ja->en': {
    'おはようございます': 'Good morning',
    'こんにちは': 'Hello / Good afternoon',
    'お疲れ様です': 'Thank you for your hard work',
    'ありがとうございます': 'Thank you very much',
    'よろしくお願いします': 'Looking forward to working with you',
    '始めましょう': "Let's begin",
    '会議を始めます': "Starting the meeting",
    '質問はありますか': 'Are there any questions?',
    '明日': 'tomorrow',
    '今日': 'today',
    '来週': 'next week',
    'わかりました': 'Understood',
  },
  // Chinese -> English
  'zh->en': {
    '早上好': 'Good morning',
    '你好': 'Hello',
    '大家好': 'Hello everyone',
    '谢谢': 'Thank you',
    '谢谢大家': 'Thank you everyone',
    '非常感谢': 'Thank you very much',
    '我们开始吧': "Let's get started",
    '今天的会议': "Today's meeting",
    '有什么问题吗': 'Are there any questions?',
    '明天': 'tomorrow',
    '今天': 'today',
    '下周': 'next week',
    '好的': 'Alright / Okay',
  },
  // Korean -> English
  'ko->en': {
    '안녕하세요': 'Hello / Good day',
    '감사합니다': 'Thank you',
    '수고하셨습니다': 'Great job / Thank you for your work',
    '시작하겠습니다': "Let's get started",
    '회의를 시작하겠습니다': "We will begin the meeting",
    '질문 있으신가요': 'Are there any questions?',
    '내일': 'tomorrow',
    '오늘': 'today',
    '다음 주': 'next week',
    '알겠습니다': 'Understood',
  },
  // French -> English
  'fr->en': {
    'bonjour': 'Good morning / Hello',
    'bonjour à tous': 'Hello everyone',
    'bonjour tout le monde': 'Good morning everyone',
    'merci': 'Thank you',
    'merci beaucoup': 'Thank you very much',
    'commençons': "Let's begin",
    'on commence': "Let's start",
    'y a-t-il des questions': 'Are there any questions?',
    'demain': 'tomorrow',
    'aujourd hui': 'today',
    'd accord': 'Agreed / Okay',
  },
};

/**
 * Normalize language identifier to standard 2-3 letter code
 */
export function normalizeLanguageCode(lang: string): string {
  if (!lang) return 'en';
  const clean = lang.trim().toLowerCase();
  if (clean === 'auto') return 'auto';
  if (clean.startsWith('fil') || clean.startsWith('tl')) return 'fil';
  const primary = clean.split('-')[0].split('_')[0];
  return primary || 'en';
}

/**
 * Get human readable language name from code across any language in the world
 */
export function getLanguageName(code: string): string {
  if (code === 'auto') return 'Auto-Detected Language';
  const norm = normalizeLanguageCode(code);
  const found = SUPPORTED_LANGUAGES.find((l) => l.code === norm);
  if (found) return found.name;
  try {
    if (typeof Intl !== 'undefined' && (Intl as any).DisplayNames) {
      const dn = new (Intl as any).DisplayNames(['en'], { type: 'language' });
      const name = dn.of(norm);
      if (name) return name;
    }
  } catch {}
  return code.toUpperCase();
}

/**
 * Heuristically detect whether text contains Filipino/Tagalog, Japanese, Chinese, Korean, French, German, Spanish, etc.
 */
export function detectLikelyLanguage(text: string): string {
  if (!text || !text.trim()) return 'en';

  // Japanese: Hiragana or Katakana
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return 'ja';

  // Korean: Hangul
  if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(text)) return 'ko';

  // Chinese: CJK ideographs without kana
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh';

  // Arabic
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';

  // Russian / Cyrillic
  if (/[\u0400-\u04FF]/.test(text)) return 'ru';

  // Thai
  if (/[\u0E00-\u0E7F]/.test(text)) return 'th';

  // Hindi / Devanagari
  if (/[\u0900-\u097F]/.test(text)) return 'hi';

  // Filipino / Tagalog: High-frequency markers
  const lower = text.toLowerCase();
  const filipinoMarkers = [
    /\b(ang|mga|nang|ng|sa|yung|kay|kina|si|sina)\b/,
    /\b(natin|namin|ninyo|kanila|atin|amin|inyo|ako|ikaw|siya|tayo|sila|ko|mo|niya|nila)\b/,
    /\b(ito|iyan|iyon|dito|diyan|doon|nito|niyan|noon)\b/,
    /\b(oo|hindi|wala|meron|mayroon|may|huwag|wag)\b/,
    /\b(salamat|kamusta|kumusta|bukas|mamaya|ngayon|kahapon|kanina)\b/,
    /\b(po|opo|ho|oho|naman|kasi|talaga|ba|daw|raw|pala|kaya|sana|muna|pa|na)\b/,
    /\b(meeting|tapusin|gawin|simulan|pag-usapan|nagkasundo|ihahanda|sabihin)\b/,
  ];
  let filCount = 0;
  for (const regex of filipinoMarkers) {
    if (regex.test(lower)) filCount++;
  }
  if (filCount >= 1 && (/\b(po|opo|natin|namin|inyo|kayo|tayo|salamat|bukas|mamaya|ihahanda|pag-usapan|mga|oo|hindi)\b/.test(lower))) {
    return 'fil';
  }
  if (filCount >= 2) return 'fil';

  // German markers
  if (/\b(guten|morgen|abend|danke|bitte|termin|besprechung|wir|nicht|eine|auf wiedersehen)\b/i.test(lower)) {
    return 'de';
  }

  // French markers
  if (/\b(bonjour|merci|s'il vous plaît|nous|vous|avec|pour|dans|cette|réunion)\b/i.test(lower)) {
    return 'fr';
  }

  // Spanish markers
  if (/\b(hola|gracias|por favor|nosotros|reunión|mañana|hoy|bienvenidos)\b/i.test(lower)) {
    return 'es';
  }

  // Italian markers
  if (/\b(buongiorno|grazie|per favore|riunione|domani|oggi|ciao)\b/i.test(lower)) {
    return 'it';
  }

  // Vietnamese markers
  if (/\b(xin chào|cảm ơn|hôm nay|ngày mai|cuộc họp)\b/i.test(lower)) {
    return 'vi';
  }

  // Indonesian markers
  if (/\b(selamat|pagi|siang|terima kasih|rapat|besok|hari ini)\b/i.test(lower)) {
    return 'id';
  }

  return 'en';
}

/**
 * Translate a single text string using Local AI (Ollama) with fallback to offline phrasebook.
 *
 * @param text - Spoken speech sentence or notes text
 * @param sourceLang - Source language code (e.g. 'fil', 'ja', 'zh', 'ko', 'fr', 'en', 'auto')
 * @param targetLang - Target language code (e.g. 'en', 'fil', 'ja')
 * @param modelName - Local Ollama model name (e.g. 'llama3.2:3b')
 * @returns Translated text string
 */
export async function translateTextAI(
  text: string,
  sourceLang: string = 'auto',
  targetLang: string = 'en',
  modelName?: string
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return '';

  const normTarget = normalizeLanguageCode(targetLang);
  let normSource = normalizeLanguageCode(sourceLang);
  if (normSource === 'auto') {
    normSource = detectLikelyLanguage(trimmed);
  }

  // If source and target are the same, return as-is
  if (normSource === normTarget) {
    return trimmed;
  }

  // Check LRU cache
  const cacheKey = getCacheKey(trimmed, normSource, normTarget);
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey)!;
  }

  // Try fast offline dictionary match for short phrases
  const dictKey = `${normSource}->${normTarget}`;
  const dict = OFFLINE_PHRASE_DICTIONARY[dictKey];
  if (dict && dict[trimmed.toLowerCase()]) {
    const offlineTranslation = dict[trimmed.toLowerCase()];
    translationCache.set(cacheKey, offlineTranslation);
    return offlineTranslation;
  }

  // If no model selected, return offline partial or original
  if (!modelName) {
    return trimmed;
  }

  const sourceName = getLanguageName(normSource);
  const targetName = getLanguageName(normTarget);

  let languageGuidelines = '';
  if (normSource === 'fil' && normTarget === 'en') {
    languageGuidelines = 'The source is Filipino / Tagalog or Taglish (mixed English-Tagalog). Translate into clean, natural English business idioms while preserving all deadlines, participant names, and technical terms.';
  } else if (normSource === 'en' && normTarget === 'fil') {
    languageGuidelines = 'The source is English. Translate into natural, professional Filipino / Tagalog (o modernong Taglish na karaniwang ginagamit sa mga propesyonal na pagpupulong sa Pilipinas). Panatilihing malinaw at madaling maunawaan.';
  } else if (normTarget === 'en') {
    languageGuidelines = `The source is ${sourceName}. Accurately and fluently translate into clear, grammatically correct English meeting speech. Preserve technical terms, numbers, dates, and names.`;
  } else {
    languageGuidelines = `Translate accurately from ${sourceName} into natural ${targetName}.`;
  }

  const prompt = `You are an expert real-time conference translator.
${languageGuidelines}

RULES:
1. Translate the spoken statement accurately with zero restrictions. Transcribe and translate any dialect, colloquialism, accent, slang, or terminology faithfully into ${targetName}.
2. Do NOT censor, refuse, omit, sanitize, or alter any part of the spoken text.
3. Return ONLY the translation.
4. Do NOT include quotes, explanations, markdown, or language prefixes (e.g. do not say "Translation:").
5. If a calendar date, time, or person's name is mentioned, preserve it accurately.

SOURCE TEXT:
${trimmed}`;

  try {
    const response = await ai.generate(prompt, {
      model: modelName,
      temperature: 0.1,
    });

    const cleaned = response
      .replace(/^["'`]|["'`]$/g, '')
      .replace(/^(translation|translated|english|filipino):\s*/i, '')
      .trim();

    if (cleaned && cleaned.length > 0) {
      if (translationCache.size >= MAX_CACHE_SIZE) {
        // Evict oldest item
        const firstKey = translationCache.keys().next().value;
        if (firstKey) translationCache.delete(firstKey);
      }
      translationCache.set(cacheKey, cleaned);
      return cleaned;
    }
  } catch (err: any) {
    console.warn('[HuskyNote] AI Translation failed, falling back to original:', err?.message);
  }

  return trimmed;
}

/**
 * Translate an array of transcript segments into a target language.
 */
export async function translateTranscriptSegments(
  segments: TranscriptSegment[],
  targetLanguage: string = 'en',
  modelName: string
): Promise<TranscriptSegment[]> {
  if (segments.length === 0) return [];

  const normTarget = normalizeLanguageCode(targetLanguage);

  // Translate in parallel batches of 4 to keep latency snappy
  const batchSize = 4;
  const results: TranscriptSegment[] = [...segments];

  for (let i = 0; i < results.length; i += batchSize) {
    const chunk = results.slice(i, i + batchSize);
    const translatedChunk = await Promise.all(
      chunk.map(async (seg) => {
        const rawSource = seg.sourceLanguage && seg.sourceLanguage !== 'auto'
          ? seg.sourceLanguage
          : detectLikelyLanguage(seg.originalText || seg.text);
        const sourceLang = normalizeLanguageCode(rawSource);
        if (sourceLang === normTarget) {
          return {
            ...seg,
            originalText: seg.originalText || seg.text,
            sourceLanguage: sourceLang,
            targetLanguage: normTarget,
            translation: seg.translation || seg.text,
          };
        }

        const textToTranslate = seg.originalText || seg.text;
        const translated = await translateTextAI(textToTranslate, sourceLang, normTarget, modelName);

        return {
          ...seg,
          originalText: seg.originalText || seg.text,
          text: translated, // Set primary text to translation
          translation: translated,
          sourceLanguage: sourceLang,
          targetLanguage: normTarget,
          isTranslating: false,
        };
      })
    );

    for (let j = 0; j < translatedChunk.length; j++) {
      results[i + j] = translatedChunk[j];
    }
  }

  return results;
}
