import React from 'react';
import { CalendarDays, Check, FileText, MousePointer2 } from 'lucide-react';
import type { LandingCopy } from './copy';
import { MockWindow, cx } from './primitives';

type Mocks = LandingCopy['mocks'];

/** The soft panel each feature mock sits on. */
const Stage: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div aria-hidden="true" className={cx('hl-stage flex min-h-[300px] items-center justify-center p-4 sm:p-8 lg:min-h-[380px]', className)}>
    <div className="w-full max-w-[440px]">{children}</div>
  </div>
);

// Deterministic bar heights (percent) so the waveform looks like speech, not noise.
const WAVE = [34, 52, 70, 46, 88, 62, 40, 74, 96, 58, 44, 80, 66, 38, 54, 90, 72, 48, 60, 84, 50, 36, 64, 42];

export const MeetingsMock: React.FC<{ copy: Mocks['meetings'] }> = ({ copy }) => (
  <Stage>
    <MockWindow
      title={
        <span className="inline-flex items-center gap-2">
          <span className="hl-rec-dot" />
          <span className="hl-ink">{copy.status}</span>
        </span>
      }
    >
      <div className="p-4 sm:p-5" data-live="true">
        <div className="flex h-12 items-center justify-between">
          {WAVE.map((h, i) => (
            <span key={i} className="hl-wave-bar" style={{ height: `${h}%`, ['--i' as string]: i } as React.CSSProperties} />
          ))}
        </div>
        <div className="hl-raised-2 hl-border mt-4 grid grid-cols-3 gap-1 rounded-[9px] p-1 text-center text-[12px]">
          {copy.engines.map((engine, i) => (
            <span
              key={engine}
              className={cx('rounded-[6px] py-1.5', i === 0 ? 'hl-raised hl-ink font-semibold' : 'hl-ink-3')}
              style={i === 0 ? { boxShadow: '0 0 0 1px var(--hl-rule)' } : undefined}
            >
              {engine}
            </span>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-2.5 text-[13px] leading-[1.45]">
          <p className="m-0 grid grid-cols-[38px_1fr] gap-2">
            <span className="hl-mono hl-ink-3 pt-[1px] text-[11px]">08:01</span>
            <span className="hl-ink-2">{copy.lineA}</span>
          </p>
          <p className="m-0 grid grid-cols-[38px_1fr] gap-2">
            <span className="hl-mono hl-ink-3 pt-[1px] text-[11px]">08:09</span>
            <span className="hl-ink-2">{copy.lineB}</span>
          </p>
        </div>
      </div>
      <div className="hl-rule-t hl-raised-2 flex items-center gap-2 px-4 py-3 sm:px-5">
        <span className="hl-ink-3 mr-1 text-[12px]">{copy.export}</span>
        <span className="hl-tag hl-tag--xs">
          <FileText size={11} strokeWidth={2} />
          {copy.pdf}
        </span>
        <span className="hl-tag hl-tag--xs">
          <FileText size={11} strokeWidth={2} />
          {copy.markdown}
        </span>
      </div>
    </MockWindow>
  </Stage>
);

const Bar: React.FC<{ w: string; className?: string }> = ({ w, className }) => <span className={cx('hl-text-bar block', className)} style={{ width: w }} />;

export const DocumentsMock: React.FC<{ copy: Mocks['documents'] }> = ({ copy }) => (
  <Stage>
    <MockWindow
      title={
        <span className="inline-flex items-center gap-1.5">
          <FileText size={13} strokeWidth={2} className="hl-accent" />
          <span className="hl-ink">{copy.file}</span>
        </span>
      }
      right={<span className="hl-mono hl-ink-3 hidden text-[11px] sm:inline">{copy.page}</span>}
    >
      <div className="grid sm:grid-cols-[1fr_1fr]">
        <div className="hl-raised-2 p-4 sm:p-5">
          <div className="hl-raised hl-border flex flex-col gap-[9px] rounded-[6px] px-4 py-5">
            <span className="hl-text-bar block h-[8px] w-[58%]" style={{ background: 'var(--hl-rule-strong)' }} />
            <Bar w="92%" className="mt-1.5" />
            <Bar w="86%" />
            <span className="hl-highlight-bar my-[2px] block h-[6px] w-[76%]" />
            <Bar w="90%" />
            <div className="hl-outline-box -mx-1.5 my-1 flex flex-col gap-[9px] px-1.5 py-2">
              <Bar w="94%" />
              <Bar w="70%" />
            </div>
            <Bar w="88%" />
            <Bar w="48%" />
          </div>
        </div>
        <div className="hl-rule-t flex flex-col justify-end gap-3 p-4 sm:border-t-0 sm:p-5" style={{ borderLeft: '1px solid var(--hl-rule)' }}>
          <p className="hl-bubble-q m-0 ml-auto max-w-[92%] px-3 py-2 text-[12.5px] leading-[1.45]">{copy.question}</p>
          <div className="hl-bubble-a max-w-[92%] px-3 py-2.5 text-[12.5px] leading-[1.45]">
            <p className="m-0">{copy.answer}</p>
            <span className="hl-chip hl-chip--accent hl-chip--xs mt-2">
              <FileText size={11} strokeWidth={2} />
              {copy.cite}
            </span>
          </div>
        </div>
      </div>
    </MockWindow>
  </Stage>
);

export const GuidesMock: React.FC<{ copy: Mocks['guides'] }> = ({ copy }) => (
  <Stage>
    <MockWindow>
      <div className="p-4 sm:p-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="hl-ink m-0 text-[14px] font-semibold tracking-[-0.01em]">{copy.title}</p>
          <span className="hl-mono hl-ink-3 text-[11px]">{copy.count}</span>
        </div>
        <ol className="m-0 mt-4 flex list-none flex-col gap-3 p-0 text-[13px]">
          <li className="flex items-center gap-2.5">
            <span className="hl-step-badge hl-step-badge--muted">1</span>
            <span className="hl-ink-2">{copy.steps[0]}</span>
          </li>
          <li>
            <div className="flex items-center gap-2.5">
              <span className="hl-step-badge">2</span>
              <span className="hl-ink font-medium">{copy.steps[1]}</span>
            </div>
            {/* Abstract screenshot of the dialog, marked where to click */}
            <div className="hl-raised-2 hl-border relative ml-[30px] mt-2.5 rounded-[8px] p-3">
              <div className="hl-raised hl-border rounded-[6px] p-3">
                <p className="hl-ink m-0 text-[11.5px] font-semibold">{copy.dialogTitle}</p>
                <div className="mt-2 flex flex-col gap-[7px]">
                  <Bar w="84%" />
                  <Bar w="62%" />
                </div>
                <div className="mt-3 flex justify-end gap-1.5 text-[11px]">
                  <span className="hl-border hl-ink-2 rounded-[5px] px-2 py-1">{copy.cancel}</span>
                  <span className="relative">
                    <span className="hl-ink inline-block rounded-[5px] px-2 py-1 font-semibold" style={{ background: 'var(--hl-accent-soft)' }}>
                      {copy.export}
                    </span>
                    <span className="hl-outline-box pointer-events-none absolute -inset-[4px]" />
                    <span className="hl-step-badge hl-step-badge--sm absolute -right-[13px] -top-[13px]">2</span>
                    <MousePointer2 size={14} strokeWidth={2} className="hl-ink absolute -bottom-[14px] right-[2px]" fill="var(--hl-raised)" />
                  </span>
                </div>
              </div>
            </div>
          </li>
          <li className="flex items-center gap-2.5">
            <span className="hl-step-badge hl-step-badge--muted">3</span>
            <span className="hl-ink-2">{copy.steps[2]}</span>
          </li>
        </ol>
      </div>
    </MockWindow>
  </Stage>
);

export const NotesMock: React.FC<{ copy: Mocks['notes'] }> = ({ copy }) => (
  <Stage>
    <div className="flex flex-col gap-3">
      <div className="hl-raised hl-border inline-flex w-fit gap-1 rounded-full p-1 text-[12px]">
        {copy.profiles.map((profile, i) => (
          <span
            key={profile}
            className={cx('rounded-full px-3 py-1', i === 0 ? 'hl-ink font-semibold' : 'hl-ink-3')}
            style={i === 0 ? { background: 'var(--hl-accent-soft)' } : undefined}
          >
            {profile}
          </span>
        ))}
      </div>
      <MockWindow>
        <div className="hl-mono px-5 py-4 text-[13px] leading-[1.75]">
          <p className="m-0">
            <span className="hl-ink-3">{copy.heading.slice(0, 2)}</span>
            <span className="hl-ink font-semibold">{copy.heading.slice(2)}</span>
          </p>
          <p className="m-0">
            <span className="hl-accent">{copy.itemA.slice(0, 1)}</span>
            <span className="hl-ink-2">{copy.itemA.slice(1)}</span>
          </p>
          <p className="m-0">
            <span className="hl-accent">{copy.itemB.slice(0, 1)}</span>
            <span className="hl-ink-2">{copy.itemB.slice(1)}</span>
          </p>
        </div>
        <div className="hl-rule-t hl-raised-2 flex items-center gap-1.5 px-5 py-2.5 text-[12px]">
          <Check size={12} strokeWidth={2.5} className="hl-ok" />
          <span className="hl-ink-2">{copy.saved}</span>
        </div>
      </MockWindow>
      <div className="hl-mock flex items-center gap-3 px-4 py-3">
        <span className="hl-icon-tile">
          <CalendarDays size={16} strokeWidth={1.9} />
        </span>
        <div className="min-w-0 text-[13px] leading-[1.4]">
          <p className="m-0">
            <span className="hl-mono hl-ink-3 text-[12px]">{copy.scheduleTime}</span>
            <span className="hl-ink-3"> · </span>
            <span className="hl-ink font-medium">{copy.scheduleTitle}</span>
          </p>
          <p className="hl-ink-3 m-0 text-[12px]">{copy.scheduleHint}</p>
        </div>
      </div>
    </div>
  </Stage>
);
