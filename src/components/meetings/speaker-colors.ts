/**
 * Speaker identity colors for transcripts: chart-1..5 assigned in order of first appearance
 * (then repeating). Names stay in text tokens; only the small dot carries the color.
 */
const SPEAKER_DOT_CLASSES = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5'] as const;

export type SpeakerColors = Map<string, string>;

/** Maps each speaker (case-insensitive) to a dot class, in the order the speakers first appear */
export function speakerColorMap(speakers: Iterable<string>): SpeakerColors {
  const map: SpeakerColors = new Map();
  for (const speaker of speakers) {
    const key = speaker.trim().toLowerCase();
    if (!map.has(key)) map.set(key, SPEAKER_DOT_CLASSES[map.size % SPEAKER_DOT_CLASSES.length]);
  }
  return map;
}

export function speakerDotClass(colors: SpeakerColors, speaker: string): string {
  return colors.get(speaker.trim().toLowerCase()) ?? 'bg-muted-foreground';
}
