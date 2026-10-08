import React, { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import type { Meeting } from '../../types';
import { Button } from '../ui/button';
import { getRecordingAudio } from '../../services/audio/recording-storage';

const timeOf = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const minutesOf = (seconds: number) => (seconds < 60 ? `${seconds} sec` : `${Math.round(seconds / 60)} min`);

/** The recordings a merged meeting was built from, each playable, with the gaps between them */
export const RecordingParts: React.FC<{ meeting: Meeting; onUnmerge: () => void; busy?: boolean }> = ({ meeting, onUnmerge, busy }) => {
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const urlsRef = useRef<string[]>([]);

  useEffect(() => () => urlsRef.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const play = async (partId: string, audioBlobId?: string) => {
    if (!audioBlobId) {
      setErrors((e) => ({ ...e, [partId]: 'This part has no saved audio.' }));
      return;
    }
    try {
      const url = URL.createObjectURL(await getRecordingAudio(audioBlobId));
      urlsRef.current.push(url);
      setAudioUrls((u) => ({ ...u, [partId]: url }));
    } catch (error) {
      setErrors((e) => ({ ...e, [partId]: error instanceof Error ? error.message : String(error) }));
    }
  };

  const parts = meeting.parts ?? [];
  if (!parts.length) return null;

  return (
    <section className="mt-6 rounded-lg border bg-card p-4" aria-labelledby="recording-parts-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id="recording-parts-title" className="text-base font-semibold text-foreground">Merged from {parts.length} recordings</h3>
          <p className="text-xs text-muted-foreground">Transcript times count from the first recording.</p>
        </div>
        <Button size="sm" variant="outline" onClick={onUnmerge} disabled={busy}>Unmerge</Button>
      </div>
      <ol className="mt-3 space-y-2">
        {parts.map((part, i) => {
          const gapSeconds = i > 0 ? Math.round((part.startTime - parts[i - 1].endTime) / 1000) : 0;
          return (
            <li key={part.meetingId} className="space-y-2">
              {gapSeconds >= 30 && (
                <p className="pl-1 text-xs text-muted-foreground">Not recorded for {minutesOf(gapSeconds)}</p>
              )}
              <div className="rounded-md bg-muted/60 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-foreground">
                    <span className="font-medium">Part {i + 1}</span>
                    <span className="text-muted-foreground"> · {timeOf(part.startTime)} – {timeOf(part.endTime)} · {minutesOf(part.durationSeconds)}</span>
                  </span>
                  {!audioUrls[part.meetingId] && (
                    <Button size="xs" variant="ghost" onClick={() => void play(part.meetingId, part.audioBlobId)}>
                      <Play aria-hidden="true" />
                      <span>Play audio</span>
                    </Button>
                  )}
                </div>
                {audioUrls[part.meetingId] && (
                  <audio className="mt-2 w-full" controls src={audioUrls[part.meetingId]} aria-label={`Audio for part ${i + 1}`} />
                )}
                {errors[part.meetingId] && <p className="mt-1 text-xs text-destructive">{errors[part.meetingId]}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
};
