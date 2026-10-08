import { describe, expect, it } from 'vitest';
import { cuesToSegments, importKindOf, mergeCues, parsePastedTranscript, parseTeamsDocxParagraphs, parseTimestamp, parseVtt, stitchCues } from '../src/services/meetings/transcript-import';
import { nextWindowEnd } from '../src/services/meetings/meeting-import';

const TEAMS_VTT = `WEBVTT

a1b2c3d4-0/12-0
00:00:03.250 --> 00:00:07.120
<v Ana Cruz>Good morning, everyone.</v>

a1b2c3d4-0/14-0
00:00:07.120 --> 00:00:09.800
<v Ana Cruz>Let's start with the exception queue.</v>

a1b2c3d4-0/20-0
00:00:10.400 --> 00:00:15.010
<v Jack Reyes>Sure. The committee meets at 2&nbsp;PM &amp; reviews the backlog.</v>

00:01:02.000 --> 00:01:05.500
<v Ana Cruz>Thanks, Jack.</v>
`;

describe('parseVtt', () => {
  it('reads Teams voice tags as speakers, with times and cleaned text', () => {
    const cues = parseVtt(TEAMS_VTT);
    expect(cues.map((c) => [c.startSeconds, c.speaker, c.text])).toEqual([
      [3.25, 'Ana Cruz', 'Good morning, everyone.'],
      [7.12, 'Ana Cruz', "Let's start with the exception queue."],
      [10.4, 'Jack Reyes', 'Sure. The committee meets at 2 PM & reviews the backlog.'],
      [62, 'Ana Cruz', 'Thanks, Jack.'],
    ]);
  });

  it('reads "Name: text" captions and files without speakers', () => {
    const cues = parseVtt('WEBVTT\r\n\r\n00:05.000 --> 00:07.000\r\nMaria: Hello there\r\n\r\n00:08.000 --> 00:09.000\r\nNo speaker here\r\n');
    expect(cues.map((c) => [c.startSeconds, c.speaker, c.text])).toEqual([[5, 'Maria', 'Hello there'], [8, 'Speaker', 'No speaker here']]);
  });
});

describe('parseTeamsDocxParagraphs', () => {
  it('reads the "Name   0:03" layout', () => {
    const cues = parseTeamsDocxParagraphs(['Weekly sync', 'October 8, 2026', 'Ana Cruz   0:03', 'Good morning, everyone.', 'Jack Reyes   1:02:05', 'Sure.', 'More from Jack.']);
    expect(cues.map((c) => [c.startSeconds, c.speaker, c.text])).toEqual([[3, 'Ana Cruz', 'Good morning, everyone.'], [3725, 'Jack Reyes', 'Sure. More from Jack.']]);
  });

  it('reads the older "0:00:03.250 --> …" layout', () => {
    const cues = parseTeamsDocxParagraphs(['0:0:3.250 --> 0:0:7.120', 'Ana Cruz', 'Good morning.', '0:0:10.400 --> 0:0:15.010', 'Jack Reyes', 'Hi.']);
    expect(cues.map((c) => [c.startSeconds, c.speaker, c.text])).toEqual([[3.25, 'Ana Cruz', 'Good morning.'], [10.4, 'Jack Reyes', 'Hi.']]);
  });
});

describe('import helpers', () => {
  it('parses timestamps in the forms transcripts use', () => {
    expect(parseTimestamp('01:02:03.450')).toBeCloseTo(3723.45);
    expect(parseTimestamp('02:03.5')).toBe(123.5);
    expect(parseTimestamp('1:05')).toBe(65);
    expect(parseTimestamp('nope')).toBeNull();
  });

  it('joins consecutive lines from one speaker into a turn', () => {
    const turns = mergeCues(parseVtt(TEAMS_VTT));
    expect(turns.map((t) => t.speaker)).toEqual(['Ana Cruz', 'Jack Reyes', 'Ana Cruz']);
    expect(turns[0].text).toBe("Good morning, everyone. Let's start with the exception queue.");
    expect(cuesToSegments(turns, 'm').map((s) => s.id)).toEqual(['m-0', 'm-1', 'm-2']);
  });

  it('recognizes transcripts, recordings and other files', () => {
    expect(importKindOf({ name: 'Weekly sync.vtt' })).toBe('transcript-vtt');
    expect(importKindOf({ name: 'Weekly sync.docx' })).toBe('transcript-docx');
    expect(importKindOf({ name: 'Recording-20261008.mp4' })).toBe('recording');
    expect(importKindOf({ name: 'call', type: 'audio/webm' })).toBe('recording');
    expect(importKindOf({ name: 'notes.pdf' })).toBe('unsupported');
  });
});

describe('nextWindowEnd', () => {
  const rate = 16000;
  it('cuts long audio at the quietest moment between 18 and 25 seconds', () => {
    const audio = new Float32Array(60 * rate).fill(0.2);
    audio.fill(0, 21 * rate, Math.round(21.5 * rate));
    const end = nextWindowEnd(audio, 0, rate);
    expect(end / rate).toBeGreaterThan(21);
    expect(end / rate).toBeLessThan(21.5);
  });

  it('takes the rest of the audio when under 25 seconds remain', () => {
    const audio = new Float32Array(40 * rate).fill(0.2);
    expect(nextWindowEnd(audio, 20 * rate, rate)).toBe(40 * rate);
  });
});

describe('mergeCues time limit', () => {
  it('keeps lines from the same speaker apart when they are minutes apart', () => {
    const turns = mergeCues([
      { startSeconds: 100, speaker: 'Jack', text: 'One.' },
      { startSeconds: 106, speaker: 'Jack', text: 'Two.' },
      { startSeconds: 250, speaker: 'Jack', text: 'Much later.' },
    ]);
    expect(turns.map((t) => [t.startSeconds, t.text])).toEqual([[100, 'One. Two.'], [250, 'Much later.']]);
  });
});

describe('parsePastedTranscript', () => {
  it('reads Teams copies with the name and time on separate lines, skipping a cut-off start and avatar initials', () => {
    const pasted = [
      'end of a sentence cut off above the selection',
      'AC', 'Ana Cruz', '0:03', 'Good morning, everyone.',
      'Ana Cruz started transcription',
      'JR', 'Jack Reyes', '1:02:05', 'Sure.', 'More from Jack.',
    ].join('\r\n');
    expect(parsePastedTranscript(pasted).map((c) => [c.startSeconds, c.speaker, c.text])).toEqual([
      [3, 'Ana Cruz', 'Good morning, everyone.'],
      [3725, 'Jack Reyes', 'Sure. More from Jack.'],
    ]);
  });

  it('reads "Name   0:03" and "Name · 00:00:03" headers, and pasted WebVTT', () => {
    expect(parsePastedTranscript('Ana Cruz   0:03\nHello there.\nJack Reyes · 00:00:09\nHi.').map((c) => [c.startSeconds, c.speaker])).toEqual([[3, 'Ana Cruz'], [9, 'Jack Reyes']]);
    expect(parsePastedTranscript('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n<v Ana>Hi</v>\n')[0]).toMatchObject({ speaker: 'Ana', text: 'Hi' });
  });

  it('finds nothing in text that is not a transcript', () => {
    expect(parsePastedTranscript('Just some notes I copied from somewhere.')).toEqual([]);
  });
});

describe('stitchCues', () => {
  it('joins pastes in time order and keeps each overlapping line once, in its longest form', () => {
    const first = parsePastedTranscript('Ana Cruz\n0:03\nGood morning.\nJack Reyes\n0:15\nWe should ship');
    const second = parsePastedTranscript('Jack Reyes\n0:15\nWe should ship on Friday.\nAna Cruz\n0:30\nAgreed.');
    const all = stitchCues(stitchCues([], second), first);
    expect(all.map((c) => [c.startSeconds, c.text])).toEqual([[3, 'Good morning.'], [15, 'We should ship on Friday.'], [30, 'Agreed.']]);
  });
});

describe('spoken-out times in Teams copies', () => {
  it('ignores the "5 minutes 36 seconds" line Teams copies for screen readers', () => {
    const pasted = ['JS', 'Marco Reyes', '5 minutes 36 seconds', '5:36', 'We need the exception list first.',
      'CF', 'Lena Ortiz', '1 hour 2 minutes 5 seconds', '1:02:05', 'Agreed.'].join('\n');
    expect(parsePastedTranscript(pasted).map((c) => [c.startSeconds, c.speaker, c.text])).toEqual([
      [336, 'Marco Reyes', 'We need the exception list first.'],
      [3725, 'Lena Ortiz', 'Agreed.'],
    ]);
  });
});

describe('stripSpokenTimeLabel', () => {
  it('removes the speaker name and spoken time Teams copies before the words', async () => {
    const { stripSpokenTimeLabel, parsePastedTranscript } = await import('../src/services/meetings/transcript-import');
    expect(stripSpokenTimeLabel('Marco Reyes 5 minutes 36 seconds Mhm.', 'Marco Reyes')).toBe('Mhm.');
    expect(stripSpokenTimeLabel('Sam Patel 1 hour 34 minutes 2 seconds Thanks.', 'Sam Patel')).toBe('Thanks.');
    expect(stripSpokenTimeLabel('Marco Reyes 5 minutes 36 seconds', 'Marco Reyes')).toBe('');
    // Real speech stays: no name in front, or a different speaker's name
    expect(stripSpokenTimeLabel('5 minutes later we came back.', 'Marco Reyes')).toBe('5 minutes later we came back.');
    expect(stripSpokenTimeLabel('Marco Reyes 5 minutes ago said so.', 'Sam Patel')).toBe('Marco Reyes 5 minutes ago said so.');
    const cues = parsePastedTranscript(['Marco Reyes', '5:36', 'Marco Reyes 5 minutes 36 seconds', 'Mhm.'].join('\n'));
    expect(cues).toEqual([{ startSeconds: 336, speaker: 'Marco Reyes', text: 'Mhm.' }]);
  });
});
