import React, { useDeferredValue, useMemo } from 'react';
import { Textarea } from '../ui/textarea';
import { parseTranscriptText } from '../../services/meetings/transcript-import';

interface PasteTranscriptFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/** A transcript pasted as text from any app, with a count of what will be saved */
export const PasteTranscriptField: React.FC<PasteTranscriptFieldProps> = ({ id, value, onChange, disabled }) => {
  const deferred = useDeferredValue(value);
  const cues = useMemo(() => parseTranscriptText(deferred), [deferred]);
  const speakers = new Set(cues.map((c) => c.speaker)).size;

  return (
    <div className="space-y-1.5">
      <Textarea
        id={id}
        aria-label="Transcript text"
        placeholder={'Ana: Good morning, everyone.\nJack: Morning. Let\'s start with the backlog.'}
        rows={8}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="max-h-80"
      />
      <p className="text-xs text-muted-foreground" role="status">
        {!deferred.trim()
          ? 'Paste a transcript from any app. "Name: text" lines keep the speaker; times like [00:01:02] are kept.'
          : cues.length
            ? `${cues.length} ${cues.length === 1 ? 'line' : 'lines'} from ${speakers} ${speakers === 1 ? 'speaker' : 'speakers'}.`
            : 'No transcript lines found in this text.'}
      </p>
    </div>
  );
};
