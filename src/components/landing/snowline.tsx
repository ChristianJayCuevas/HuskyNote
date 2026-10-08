import React from 'react';

/** The hairline mountain ridge ("snowline") that closes the hero; the band color fills in below it. */
export const SnowlineRidge: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={`hl-ridge ${className ?? ''}`} viewBox="0 0 1200 48" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
    <path d="M0 40 L120 30 L190 36 L300 14 L360 26 L430 20 L520 34 L640 8 L720 24 L800 18 L900 32 L1010 16 L1090 28 L1200 22 V48 H0 Z" fill="var(--hl-band)" />
    <path
      d="M0 40 L120 30 L190 36 L300 14 L360 26 L430 20 L520 34 L640 8 L720 24 L800 18 L900 32 L1010 16 L1090 28 L1200 22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
    />
  </svg>
);

/** A paw print, used as the step badges on the "how it works" trail. */
export const PawGlyph: React.FC<{ size?: number; className?: string }> = ({ size = 24, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
    <g fill="currentColor">
      <ellipse cx="12" cy="15.5" rx="4.6" ry="3.8" />
      <circle cx="6.6" cy="10.4" r="1.9" />
      <circle cx="9.9" cy="7.4" r="2" />
      <circle cx="14.1" cy="7.4" r="2" />
      <circle cx="17.4" cy="10.4" r="1.9" />
    </g>
  </svg>
);
