import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  detectLikelyLanguage,
  translateTextAI,
  translateTranscriptSegments,
  SUPPORTED_LANGUAGES,
  TRANSLATION_TARGETS,
  clearTranslationCache,
} from '../src/services/ai/translation';
import {
  parseDateExpression,
  parseTimeExpression,
  detectEventFromSentence,
} from '../src/services/calendar/event-detector';
import { LiveSpeechTranscriber, synthesizeMeetingAI } from '../src/services/audio/transcriber';
import type { TranscriptSegment } from '../src/types';

describe('Multilingual Speech Recognition & AI Translation System', () => {
  beforeEach(() => {
    clearTranslationCache();
    vi.restoreAllMocks();
  });

  describe('Language Catalog & Metadata', () => {
    it('defines supported BCP-47 speech recognition languages with flags and names', () => {
      const bcpTags = SUPPORTED_LANGUAGES.map((l) => l.bcp47);
      expect(bcpTags).toContain('auto');
      expect(bcpTags).toContain('en-US');
      expect(bcpTags).toContain('fil-PH');
      expect(bcpTags).toContain('ja-JP');
      expect(bcpTags).toContain('zh-CN');
      expect(bcpTags).toContain('ko-KR');
      expect(bcpTags).toContain('fr-FR');
      expect(bcpTags).toContain('es-ES');
      expect(bcpTags).toContain('de-DE');
    });

    it('provides translation target options including English and Filipino', () => {
      const targets = TRANSLATION_TARGETS.map((t) => t.code);
      expect(targets).toContain('en');
      expect(targets).toContain('fil');
      expect(targets).toContain('ja');
      expect(targets).toContain('zh');
      expect(targets).toContain('ko');
      expect(targets).toContain('fr');
      expect(targets).toContain('de');
      expect(targets).toContain('it');
      expect(targets).toContain('none');
    });
  });

  describe('Automatic Spoken Language Detection (detectLikelyLanguage)', () => {
    it('detects Japanese from Hiragana and Katakana characters', () => {
      expect(detectLikelyLanguage('本日のミーティングを開始します。よろしくお願いします。')).toBe('ja');
      expect(detectLikelyLanguage('プロジェクトのスケジュールを確認してください。')).toBe('ja');
    });

    it('detects Korean from Hangul characters', () => {
      expect(detectLikelyLanguage('안녕하세요 오늘 프로젝트 회의를 시작하겠습니다.')).toBe('ko');
      expect(detectLikelyLanguage('다음 주 월요일까지 보고서를 제출해주세요.')).toBe('ko');
    });

    it('detects Chinese from Hanzi characters without Japanese kana', () => {
      expect(detectLikelyLanguage('今天我们要讨论新产品的开发计划与预算。')).toBe('zh');
      expect(detectLikelyLanguage('请大家确认一下会议记录。')).toBe('zh');
    });

    it('detects Filipino / Tagalog from linguistic markers and particles', () => {
      expect(detectLikelyLanguage('Magandang umaga po sa inyong lahat, pag-usapan natin ang bagong release.')).toBe('fil');
      expect(detectLikelyLanguage('Kailangan natin tapusin ito bukas para sa mga stakeholders.')).toBe('fil');
    });

    it('detects French from accented characters and common French words', () => {
      expect(detectLikelyLanguage('Bonjour à tous, nous allons discuter du budget prévisionnel.')).toBe('fr');
    });

    it('defaults to en for standard English text', () => {
      expect(detectLikelyLanguage('Good morning everyone, let us review the quarterly sprint metrics.')).toBe('en');
    });
  });

  describe('Offline Fast Phrase Translation Fallback', () => {
    it('translates Filipino greetings and common phrases to English instantly offline', async () => {
      const t1 = await translateTextAI('magandang umaga', 'fil', 'en');
      expect(t1.toLowerCase()).toContain('good morning');

      const t2 = await translateTextAI('maraming salamat po', 'fil', 'en');
      expect(t2.toLowerCase()).toContain('thank you');
    });

    it('translates English to Filipino greetings and phrases offline', async () => {
      const t1 = await translateTextAI('good morning', 'en', 'fil');
      expect(t1.toLowerCase()).toContain('magandang umaga');

      const t2 = await translateTextAI('thank you very much', 'en', 'fil');
      expect(t2.toLowerCase()).toContain('maraming salamat');
    });

    it('translates Japanese common meeting phrases to English offline', async () => {
      const t1 = await translateTextAI('おはようございます', 'ja', 'en');
      expect(t1.toLowerCase()).toContain('good morning');

      const t2 = await translateTextAI('ありがとうございます', 'ja', 'en');
      expect(t2.toLowerCase()).toContain('thank you');
    });

    it('translates Chinese common meeting phrases to English offline', async () => {
      const t1 = await translateTextAI('早上好', 'zh', 'en');
      expect(t1.toLowerCase()).toContain('good morning');

      const t2 = await translateTextAI('谢谢大家', 'zh', 'en');
      expect(t2.toLowerCase()).toContain('thank you');
    });

    it('translates Korean phrases to English offline', async () => {
      const t1 = await translateTextAI('안녕하세요', 'ko', 'en');
      expect(t1.toLowerCase()).toContain('hello');

      const t2 = await translateTextAI('감사합니다', 'ko', 'en');
      expect(t2.toLowerCase()).toContain('thank you');
    });

    it('translates French phrases to English offline', async () => {
      const t1 = await translateTextAI('bonjour tout le monde', 'fr', 'en');
      expect(t1.toLowerCase()).toContain('good morning');

      const t2 = await translateTextAI('merci beaucoup', 'fr', 'en');
      expect(t2.toLowerCase()).toContain('thank you very much');
    });
  });

  describe('Dynamic AI Translation Pipeline (Ollama Integration)', () => {
    it('invokes Ollama with custom translation instructions when phrase is not in offline dictionary', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: 'Our main priority for next quarter is launching the mobile application.'
        }),
      });
      global.fetch = mockFetch;

      const input = 'Ang pangunahing priority natin sa susunod na quarter ay ang paglulunsad ng mobile application.';
      const result = await translateTextAI(input, 'fil', 'en', 'llama3:8b');

      expect(result).toBe('Our main priority for next quarter is launching the mobile application.');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Verify prompt instruction includes target English and context instructions
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.prompt).toContain('Translate into clean, natural English business idioms');
      expect(requestBody.prompt).toContain(input);
    });

    it('translates Japanese business speech accurately to English via AI', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: 'We will present the financial forecast in tomorrow afternoon meeting.'
        }),
      });
      global.fetch = mockFetch;

      const input = '明日の午後の会議で財務予測を発表いたします。';
      const result = await translateTextAI(input, 'ja', 'en', 'qwen2.5:7b');

      expect(result).toBe('We will present the financial forecast in tomorrow afternoon meeting.');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('translates Chinese business speech accurately to English via AI', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: 'Next sprint we will optimize the database queries to reduce server latency.'
        }),
      });
      global.fetch = mockFetch;

      const input = '在下一个冲刺中，我们将优化数据库查询以减少服务器延迟。';
      const result = await translateTextAI(input, 'zh', 'en', 'qwen2.5:7b');

      expect(result).toBe('Next sprint we will optimize the database queries to reduce server latency.');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('translates Korean business speech accurately to English via AI', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: 'Please submit the frontend pull requests before Friday noon.'
        }),
      });
      global.fetch = mockFetch;

      const input = '금요일 정오 전까지 프론트엔드 풀 리퀘스트를 제출해 주세요.';
      const result = await translateTextAI(input, 'ko', 'en', 'qwen2.5:7b');

      expect(result).toBe('Please submit the frontend pull requests before Friday noon.');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('translates French speech accurately to English via AI', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: 'We must validate the security compliance audit by tomorrow.'
        }),
      });
      global.fetch = mockFetch;

      const input = 'Nous devons valider l audit de conformité de sécurité d ici demain.';
      const result = await translateTextAI(input, 'fr', 'en', 'qwen2.5:7b');

      expect(result).toBe('We must validate the security compliance audit by tomorrow.');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('caches translation results in memory to eliminate redundant LLM calls', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ response: 'The user database has been successfully migrated.' }),
      });
      global.fetch = mockFetch;

      const input = 'Na-migrate na nang maayos ang database ng mga user.';
      const res1 = await translateTextAI(input, 'fil', 'en', 'test-model');
      const res2 = await translateTextAI(input, 'fil', 'en', 'test-model');

      expect(res1).toBe(res2);
      // Fetch should only be called ONCE because second invocation hits the translation cache
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('falls back gracefully to original text if Ollama server is offline', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

      const input = 'Unknown technical phrase that cannot be translated offline.';
      const result = await translateTextAI(input, 'fil', 'en', 'test-model');

      expect(result).toBe(input);
    });
  });

  describe('Batch Transcript Translation (translateTranscriptSegments)', () => {
    it('translates all transcript segments in parallel preserving metadata', async () => {
      global.fetch = vi.fn().mockImplementation(async (_url, options) => {
        const body = JSON.parse(options.body);
        if (body.prompt.includes('Kailangan')) {
          return { ok: true, json: async () => ({ response: 'We need to submit the report.' }) };
        }
        if (body.prompt.includes('ihahanda')) {
          return { ok: true, json: async () => ({ response: 'Yes, I will prepare it.' }) };
        }
        return { ok: true, json: async () => ({ response: 'Translated text' }) };
      });

      const rawSegments: TranscriptSegment[] = [
        {
          id: 'seg-1',
          timestampSeconds: 10,
          speaker: 'Lead Engineer',
          text: 'Kailangan natin isumite ang report bukas.',
        },
        {
          id: 'seg-2',
          timestampSeconds: 25,
          speaker: 'Product Manager',
          text: 'Oo, ihahanda ko ito mamaya.',
        },
      ];

      const translated = await translateTranscriptSegments(rawSegments, 'en', 'test-model');

      expect(translated.length).toBe(2);
      expect(translated[0].id).toBe('seg-1');
      expect(translated[0].speaker).toBe('Lead Engineer');
      expect(translated[0].originalText).toBe('Kailangan natin isumite ang report bukas.');
      expect(translated[0].translation).toBe('We need to submit the report.');
      expect(translated[0].targetLanguage).toBe('en');

      expect(translated[1].id).toBe('seg-2');
      expect(translated[1].speaker).toBe('Product Manager');
      expect(translated[1].originalText).toBe('Oo, ihahanda ko ito mamaya.');
      expect(translated[1].translation).toBe('Yes, I will prepare it.');
    });
  });

  describe('Multilingual Meeting Summarization (synthesizeMeetingAI)', () => {
    it('synthesizes non-English meetings into English structured summary with action items', async () => {
      const mockResult = {
        overview: 'The engineering team discussed project milestones and agreed to deploy the new microservices architecture next week.',
        decisions: ['Microservices deployment scheduled for next week', 'Database migration approved'],
        actionItems: [
          {
            task: 'Conduct staging load tests',
            owner: 'Lead Dev',
          },
        ],
        topics: ['Microservices', 'Deployment'],
        followUpTasks: ['Rollback plan'],
        timeline: [],
        detectedEvents: [],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: '```json\n' + JSON.stringify(mockResult) + '\n```',
        }),
      });

      const segments: TranscriptSegment[] = [
        {
          id: 's1',
          timestampSeconds: 0,
          speaker: 'Speaker 1',
          text: 'Magandang araw. Pag-usapan natin ang deployment natin sa susunod na linggo.',
        },
        {
          id: 's2',
          timestampSeconds: 15,
          speaker: 'Speaker 2',
          text: 'Tapos na ang database migration nang walang aberya.',
        },
      ];

      const { summary } = await synthesizeMeetingAI(segments, '', 'test-model', 'Engineering Sync', 'en');

      expect(summary.overview).toContain('engineering team');
      expect(summary.decisions.length).toBe(2);
      expect(summary.actionItems.length).toBe(1);
      expect(summary.actionItems[0].task).toContain('staging load tests');
      expect(summary.summaryLanguage).toBe('en');
    });

    it('synthesizes meeting into Filipino when targetSummaryLanguage is fil', async () => {
      const mockResultFil = {
        overview: 'Tinalakay ng koponan ang mga pangunahing layunin at nakatakdang gawain para sa release.',
        decisions: ['Inaprubahan ang bagong release schedule'],
        actionItems: [
          {
            task: 'I-review ang pull requests',
            owner: 'Arron',
          },
        ],
        topics: ['Release Checklist'],
        followUpTasks: ['Subukan ang bagong build'],
        timeline: [],
        detectedEvents: [],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: JSON.stringify(mockResultFil),
        }),
      });

      const segments: TranscriptSegment[] = [
        {
          id: 's1',
          timestampSeconds: 0,
          speaker: 'Speaker 1',
          text: 'Let us coordinate on the release checklist for this sprint.',
        },
      ];

      const { summary } = await synthesizeMeetingAI(segments, '', 'test-model', 'Release Sync', 'fil');

      expect(summary.overview).toContain('Tinalakay ng koponan');
      expect(summary.actionItems[0].owner).toBe('Arron');
      expect(summary.summaryLanguage).toBe('fil');
      expect(summary.aiGenerated).toBe(true);
    });

    it('marks the summary as not written by AI, with the reason, when the AI call fails', async () => {
      global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
      const segments: TranscriptSegment[] = [
        { id: 's1', timestampSeconds: 0, speaker: 'Speaker 1', text: 'Mic test, can everyone hear me?' },
      ];

      const { summary } = await synthesizeMeetingAI(segments, '', 'test-model', 'Kickoff', 'en');

      expect(summary.aiGenerated).toBe(false);
      expect(summary.aiError).toBeTruthy();
      expect(summary.decisions).toEqual([]);
    });
  });

  describe('Multilingual Calendar & Date Detection', () => {
    const fixedBaseDate = new Date(2026, 8, 16, 10, 0, 0); // 2026-09-16 (Wednesday)

    it('detects Tagalog/Filipino relative dates (bukas, ngayon, sa makalawa)', () => {
      expect(parseDateExpression('mag-meeting tayo bukas', fixedBaseDate)).toBe('2026-09-17');
      expect(parseDateExpression('kailangan matapos ngayon', fixedBaseDate)).toBe('2026-09-16');
      expect(parseDateExpression('kita tayo sa makalawa', fixedBaseDate)).toBe('2026-09-18');
    });

    it('detects Tagalog time expressions (alas tres ng hapon, alas diyes)', () => {
      expect(parseTimeExpression('mag-usap tayo alas tres ng hapon')).toBe('15:00');
      expect(parseTimeExpression('meeting ng alas diyes ng umaga')).toBe('10:00');
      expect(parseTimeExpression('alas kuwatro ng hapon')).toBe('16:00');
    });

    it('detects full calendar event from a Filipino meeting sentence', () => {
      const sentence = 'Magkaroon tayo ng sprint sync bukas alas tres ng hapon.';
      const event = detectEventFromSentence(sentence, fixedBaseDate);

      expect(event).not.toBeNull();
      expect(event?.date).toBe('2026-09-17');
      expect(event?.time).toBe('15:00');
      expect(event?.category).toBe('meeting');
    });

    it('detects Japanese calendar dates (明日, 明後日, 来週)', () => {
      expect(parseDateExpression('明日の会議', fixedBaseDate)).toBe('2026-09-17');
      expect(parseDateExpression('明後日にレビュー', fixedBaseDate)).toBe('2026-09-18');
    });

    it('detects Chinese calendar dates (明天, 后天, 下周)', () => {
      expect(parseDateExpression('明天下午开会', fixedBaseDate)).toBe('2026-09-17');
      expect(parseDateExpression('后天提交报告', fixedBaseDate)).toBe('2026-09-18');
    });
  });

  describe('LiveSpeechTranscriber Dynamic Language Switching', () => {
    it('defaults to auto language detection and allows dynamic switching', () => {
      const transcriber = new LiveSpeechTranscriber();
      expect(transcriber.getLanguage()).toBe('auto');

      transcriber.setLanguage('fil-PH');
      expect(transcriber.getLanguage()).toBe('fil-PH');

      transcriber.setLanguage('ja-JP');
      expect(transcriber.getLanguage()).toBe('ja-JP');

      transcriber.setLanguage('zh-CN');
      expect(transcriber.getLanguage()).toBe('zh-CN');

      transcriber.setLanguage('auto');
      expect(transcriber.getLanguage()).toBe('auto');
    });

    it('auto-detects foreign language and translates into English by default', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: 'Good morning, let us start the weekly sprint planning.'
        }),
      });
      global.fetch = mockFetch;

      const japaneseSpeech = 'おはようございます、今週のスプリント計画を始めましょう。';
      // When source language is 'auto', it auto-detects 'ja' and translates to target 'en'
      const translated = await translateTextAI(japaneseSpeech, 'auto', 'en', 'llama3:8b');

      expect(translated).toBe('Good morning, let us start the weekly sprint planning.');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('is capable of translating into any target language chosen by the user', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: 'Wir werden morgen die neue Benutzeroberfläche bereitstellen.'
        }),
      });
      global.fetch = mockFetch;

      const englishSpeech = 'We will deploy the new user interface tomorrow.';
      // User specifies target language 'de' (German)
      const translated = await translateTextAI(englishSpeech, 'en', 'de', 'llama3:8b');

      expect(translated).toBe('Wir werden morgen die neue Benutzeroberfläche bereitstellen.');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('has zero restrictions on language codes and translates any dialect without filtering', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: 'Wszystkie zadania zostały pomyślnie zrealizowane.'
        }),
      });
      global.fetch = mockFetch;

      const input = 'All deliverables have been completed successfully.';
      // Polish ('pl') or any language code in the world
      const translated = await translateTextAI(input, 'en', 'pl', 'llama3:8b');

      expect(translated).toBe('Wszystkie zadania zostały pomyślnie zrealizowane.');
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.prompt).toContain('zero restrictions');
      expect(requestBody.prompt).toContain('Do NOT censor');
    });
  });
});
