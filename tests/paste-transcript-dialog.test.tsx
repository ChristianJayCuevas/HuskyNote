/** @vitest-environment jsdom */
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '../src/db';
import { PasteTranscriptDialog } from '../src/components/meetings/paste-transcript-dialog';

afterEach(cleanup);

describe('PasteTranscriptDialog', () => {
  it('saves the pasted text as the meeting transcript', async () => {
    await db.meetings.put({
      id: 'm1', title: 'Recorded', startTime: 1, durationSeconds: 0, createdAt: 1, manualNotes: '',
      transcript: [], timeline: [], screenshots: [],
    });
    const onOpenChange = vi.fn();
    const onDone = vi.fn();
    render(<PasteTranscriptDialog open onOpenChange={onOpenChange} meetingId="m1" onDone={onDone} />);

    const save = screen.getByRole('button', { name: 'Save transcript' });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Transcript text'), { target: { value: 'Ana: Hello\nJack: Hi' } });
    await screen.findByText('2 lines from 2 speakers.');
    fireEvent.click(save);

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onDone).toHaveBeenCalledWith(expect.stringContaining('2 speaker turns'));
    expect((await db.meetings.get('m1'))?.transcript.map((s) => s.text)).toEqual(['Hello', 'Hi']);
  });
});
