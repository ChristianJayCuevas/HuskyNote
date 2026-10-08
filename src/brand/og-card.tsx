import type { CSSProperties } from 'react';
import { BRAND, BRAND_COLORS } from './colors';
import { HuskyPeek } from './husky-art';
import { HuskyMark } from './husky-mark';
import { HuskyWordmark } from './husky-logo';

// Social preview card (1200x630). Rendered only by scripts/brand/generate-brand-assets.ts,
// which supplies the Geist @font-face rules; the app never ships this component.

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const C = BRAND_COLORS.light;
const SANS = "var(--font-brand-sans, 'Geist Variable', system-ui, sans-serif)";
const MONO = "var(--font-brand-mono, 'Geist Mono Variable', ui-monospace, monospace)";

const RULE = 36;
const MARGIN_X = 96;

function TranscriptLine({ time, who, width }: { time: string; who: string; width: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, height: 40 }}>
      <span style={{ fontFamily: MONO, fontSize: 15, color: C.ink3, fontVariantNumeric: 'tabular-nums', width: 48 }}>
        {time}
      </span>
      <span style={{ fontFamily: SANS, fontSize: 16, fontWeight: 600, color: C.ink2, width: 92 }}>{who}</span>
      <span style={{ height: 10, width, borderRadius: 5, background: '#E6E4DD' }} />
    </div>
  );
}

export function OgCard() {
  const root: CSSProperties = {
    position: 'relative',
    width: OG_WIDTH,
    height: OG_HEIGHT,
    overflow: 'hidden',
    background: C.bg,
    backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${RULE - 1}px, #ECEAE3 ${RULE - 1}px, #ECEAE3 ${RULE}px)`,
    color: C.ink,
    fontFamily: SANS,
  };

  return (
    <div style={root}>
      {/* notebook margin line */}
      <div
        style={{ position: 'absolute', top: 0, bottom: 0, left: MARGIN_X, width: 2, background: 'rgba(29,95,209,0.25)' }}
      />

      {/* left column */}
      <div style={{ position: 'absolute', left: MARGIN_X + 56, top: 136, width: 600 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <HuskyMark size={120} tone="ink" />
          <HuskyWordmark style={{ fontSize: 84, color: C.ink }} />
        </div>
        <div
          style={{
            marginTop: 56,
            fontSize: 46,
            fontWeight: 620,
            letterSpacing: '-0.035em',
            lineHeight: 1.1,
            color: C.ink,
          }}
        >
          Sit.{' '}
          <span
            style={{
              background: 'rgba(245,184,61,0.38)',
              borderRadius: 6,
              padding: '0 6px',
              margin: '0 -6px',
            }}
          >
            Stay.
          </span>{' '}
          Take notes.
        </div>
        <div style={{ marginTop: 28, fontFamily: MONO, fontSize: 24, lineHeight: 1.5, color: C.ink2 }}>
          <div>{BRAND.descriptor}</div>
          <div style={{ color: C.ink3 }}>{BRAND.platforms}</div>
        </div>
      </div>

      {/* right: product card with the husky peeking over it */}
      <div
        style={{
          position: 'absolute',
          left: 790,
          top: 306,
          width: 460,
          height: 400,
          background: C.raised,
          borderRadius: 18,
          border: `1px solid ${C.rule}`,
          boxShadow: '0 1px 2px rgba(18,22,31,.06), 0 24px 48px -24px rgba(18,22,31,.22)',
        }}
      >
        <div
          style={{
            height: 52,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 22px',
            borderBottom: `1px solid ${C.rule}`,
            fontSize: 15,
            color: C.ink3,
          }}
        >
          <span>
            Meetings <span style={{ margin: '0 6px' }}>/</span>
            <span style={{ color: C.ink, fontWeight: 560 }}>Weekly planning</span>
          </span>
        </div>
        <div style={{ padding: '18px 22px 0' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              height: 28,
              padding: '0 12px',
              borderRadius: 14,
              background: '#E7F4EE',
              color: C.ok,
              fontSize: 14,
              fontWeight: 560,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M3 7.4L5.8 10L11 4.4" fill="none" stroke={C.ok} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Saved on this device
          </div>
          <div style={{ marginTop: 14 }}>
            <TranscriptLine time="00:04" who="You" width={190} />
            <TranscriptLine time="00:19" who="Speaker 2" width={150} />
            <TranscriptLine time="00:31" who="You" width={170} />
          </div>
        </div>
      </div>
      <HuskyPeek
        tone="ink"
        size={300}
        style={{ position: 'absolute', left: 860, top: 306 - 300 * (121 / 120), display: 'block' }}
      />
    </div>
  );
}
