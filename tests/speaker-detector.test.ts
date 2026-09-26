import { describe, it, expect, beforeEach } from 'vitest';
import {
  cleanSpeakerName,
  detectConversationalSpeaker,
  MeetingSpeakerHook,
} from '../src/services/audio/speaker-detector';

describe('Automatic Speaker Name Hook & Detection Engine', () => {
  describe('cleanSpeakerName', () => {
    it('cleans UI roles and suffixes from meeting apps', () => {
      expect(cleanSpeakerName('Arron Parejas (You)')).toBe('Arron Parejas');
      expect(cleanSpeakerName('Sarah Jenkins (Host)')).toBe('Sarah Jenkins');
      expect(cleanSpeakerName('Alex Chen (Co-host)')).toBe('Alex Chen');
      expect(cleanSpeakerName('David Miller (External)')).toBe('David Miller');
      expect(cleanSpeakerName('Elena Rostova (Presenter)')).toBe('Elena Rostova');
      expect(cleanSpeakerName('Guest User (Guest)')).toBe('Guest User');
    });

    it('removes emojis and trailing counts', () => {
      expect(cleanSpeakerName('👋 Sarah Connor (2)')).toBe('Sarah Connor');
      expect(cleanSpeakerName('🚀 Marcus Vance')).toBe('Marcus Vance');
    });

    it('rejects UI buttons, controls, non-human labels, and dummy placeholder names', () => {
      expect(cleanSpeakerName('Mute')).toBeNull();
      expect(cleanSpeakerName('Unmute')).toBeNull();
      expect(cleanSpeakerName('Turn off microphone')).toBeNull();
      expect(cleanSpeakerName('Leave meeting')).toBeNull();
      expect(cleanSpeakerName('Raise hand')).toBeNull();
      expect(cleanSpeakerName('Participants')).toBeNull();
      expect(cleanSpeakerName('Chat')).toBeNull();
      expect(cleanSpeakerName('Speaker 1')).toBeNull();
      expect(cleanSpeakerName('Speaker 2')).toBeNull();
      expect(cleanSpeakerName('Participant 1')).toBeNull();
      expect(cleanSpeakerName('Participant 2')).toBeNull();
      expect(cleanSpeakerName('Name1')).toBeNull();
      expect(cleanSpeakerName('Name2')).toBeNull();
      expect(cleanSpeakerName('Jane Smith')).toBeNull();
      expect(cleanSpeakerName('John Doe')).toBeNull();
      expect(cleanSpeakerName('10:45')).toBeNull();
      expect(cleanSpeakerName('')).toBeNull();
    });
  });

  describe('detectConversationalSpeaker', () => {
    it('detects English self-introductions accurately', () => {
      const match1 = detectConversationalSpeaker('Hi everyone, this is Arron from product');
      expect(match1).not.toBeNull();
      expect(match1?.name).toBe('Arron');
      expect(match1?.isSelfIntro).toBe(true);

      const match2 = detectConversationalSpeaker('Hey team, Sarah Jenkins here, ready to present');
      expect(match2).not.toBeNull();
      expect(match2?.name).toBe('Sarah Jenkins');
      expect(match2?.isSelfIntro).toBe(true);

      const match3 = detectConversationalSpeaker('Good morning, my name is Alex Chen');
      expect(match3).not.toBeNull();
      expect(match3?.name).toBe('Alex Chen');
      expect(match3?.isSelfIntro).toBe(true);

      const match4 = detectConversationalSpeaker('This is Dr. Watson speaking');
      expect(match4).not.toBeNull();
      expect(match4?.name).toBe('Dr. Watson');
      expect(match4?.isSelfIntro).toBe(true);

      // Exact case from live meeting user screenshot:
      const match5 = detectConversationalSpeaker('guys my name is liz from ivy');
      expect(match5).not.toBeNull();
      expect(match5?.name).toBe('Liz');
      expect(match5?.isSelfIntro).toBe(true);
    });

    it('rejects common phrases that are not human names', () => {
      expect(detectConversationalSpeaker('this is great')).toBeNull();
      expect(detectConversationalSpeaker('this is working properly')).toBeNull();
      expect(detectConversationalSpeaker('it is done')).toBeNull();
    });

    it('detects Filipino self-introductions accurately', () => {
      const match = detectConversationalSpeaker('Ako nga pala si Maria para sa report ngayon');
      expect(match).not.toBeNull();
      expect(match?.name).toBe('Maria');
      expect(match?.isSelfIntro).toBe(true);
    });

    it('detects direct address handoffs and questions to other speakers', () => {
      const handoff1 = detectConversationalSpeaker('Over to you, Sarah');
      expect(handoff1).not.toBeNull();
      expect(handoff1?.name).toBe('Sarah');
      expect(handoff1?.isHandoff).toBe(true);

      const handoff2 = detectConversationalSpeaker('David, what do you think about the proposed timeline?');
      expect(handoff2).not.toBeNull();
      expect(handoff2?.name).toBe('David');
      expect(handoff2?.isHandoff).toBe(true);
    });

    it('matches known roster mentions', () => {
      const known = ['You / Host', 'Elena Rostova', 'Michael Chang'];
      const mention = detectConversationalSpeaker('Thanks Elena for the breakdown', known);
      expect(mention).not.toBeNull();
      expect(mention?.name).toBe('Elena Rostova');
    });

    it('returns null for generic sentences without names', () => {
      expect(detectConversationalSpeaker('Let us look at the budget numbers')).toBeNull();
      expect(detectConversationalSpeaker('Can you hear me properly?')).toBeNull();
    });
  });

  describe('MeetingSpeakerHook State Manager & Processor', () => {
    let hook: MeetingSpeakerHook;

    beforeEach(() => {
      hook = MeetingSpeakerHook.getInstance();
      hook.reset();
    });

    it('processes multi-app sync payloads from Google Meet, Teams, or Zoom', () => {
      hook.handleIncomingPayload({
        type: 'HUSKYNOTE_MEETING_PARTICIPANTS',
        app: 'Google Meet',
        participants: ['Arron Parejas (You)', 'Sarah Connor', 'Alex Chen (Host)'],
        activeSpeaker: 'Sarah Connor',
      });

      expect(hook.getDetectedApp()).toBe('Google Meet');
      const speakers = hook.getDiscoveredSpeakers();
      expect(speakers).toContain('Arron Parejas');
      expect(speakers).toContain('Sarah Connor');
      expect(speakers).toContain('Alex Chen');
      expect(hook.getActiveSpeaker()).toBe('Sarah Connor');
    });

    it('automatically eliminates generic Speaker 1 / 2 and assigns real participant names', () => {
      // With known participants
      const roster = ['You / Host', 'Arron Parejas', 'Sarah Connor'];

      // If incoming segment is attributed to generic "Speaker 1" or "Guest"
      const result1 = hook.processSegment('Hello everyone', 'Speaker 2', roster);
      expect(result1.assignedSpeaker).toBe('Arron Parejas'); // maps generic label to first discovered external person
      expect(result1.assignedSpeaker).not.toBe('Speaker 2');

      // If segment contains self-intro, it dynamically hooks and switches to that name
      const result2 = hook.processSegment('Hi team, this is David Miller from design', 'You / Host', roster);
      expect(result2.assignedSpeaker).toBe('David Miller');
      expect(result2.updatedRoster).toContain('David Miller');
    });

    it('propagates handoffs to the next speaker turn', () => {
      const roster = ['You / Host', 'Arron Parejas', 'Sarah Connor'];
      // Turn 1: Arron hands off to Sarah
      hook.processSegment('Over to you, Sarah', 'Arron Parejas', roster);

      // Turn 2: Reply comes in
      const turn2 = hook.processSegment('Thanks Arron, I have the slides open', 'You / Host', roster);
      expect(turn2.assignedSpeaker).toBe('Sarah Connor');
    });

    it('handles two-part conversational self-introductions split across segments', () => {
      const roster = ['You / Host'];
      // Segment 1: ends in "hi guys my name is"
      const seg1 = hook.processSegment('hi guys my name is', 'You / Host', roster);
      expect(seg1.assignedSpeaker).toBe('You / Host');

      // Segment 2: user says "german" or "german here"
      const seg2 = hook.processSegment('german from backend', 'You / Host', roster);
      expect(seg2.assignedSpeaker).toBe('German');
      expect(seg2.updatedRoster).toContain('German');
    });

    it('accurately attributes speakers using audio channel hints (Host Mic vs Remote Meeting Tab Audio)', () => {
      const roster = ['You / Host', 'German'];

      // When tab audio analyser detects remote participant audio
      const remoteTurn = hook.processSegment('I agree with the roadmap', 'You / Host', roster, 'remote');
      expect(remoteTurn.assignedSpeaker).toBe('German');

      // When host mic analyser detects host speaking
      const hostTurn = hook.processSegment('Sounds good, let us proceed', 'German', roster, 'host');
      expect(hostTurn.assignedSpeaker).toBe('You / Host');
    });

    it('never introduces dummy names like Participant 2 or Speaker 1 when remote channel speaks without roster', () => {
      const roster = ['You / Host'];
      // When remote audio arrives before any OCR/DOM roster is available
      const remoteTurn = hook.processSegment('Hello everyone, can you see my screen?', 'You / Host', roster, 'remote');
      expect(remoteTurn.assignedSpeaker).toBe('Remote Participant');
      expect(remoteTurn.assignedSpeaker).not.toBe('Participant 2');
      expect(remoteTurn.assignedSpeaker).not.toBe('Speaker 1');
      expect(remoteTurn.assignedSpeaker).not.toBe('Jane Smith');
      expect(remoteTurn.assignedSpeaker).not.toBe('John Doe');
      // Roster must not be polluted with dummy names
      expect(remoteTurn.updatedRoster).not.toContain('Participant 2');
      expect(remoteTurn.updatedRoster).not.toContain('Speaker 1');
      expect(remoteTurn.updatedRoster).not.toContain('Jane Smith');
    });

    it('cleans Google Meet tile names and ignores UI controls', () => {
      expect(cleanSpeakerName('german')).toBe('German');
      expect(cleanSpeakerName('Track Attendance')).toBeNull();
      expect(cleanSpeakerName('Stop Sharing')).toBeNull();
    });
  });
});
