import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CalendarDays, Check, FileText, House, ListChecks, Mic, NotebookPen, PenLine, AudioLines } from 'lucide-react';
import { HuskyMark } from '../../brand';
import type { LandingCopy } from './copy';
import { cx } from './primitives';

type Phase = 'recording' | 'writing' | 'saved';

interface Frame {
  shown: number;
  phase: Phase;
  hold: number;
  resetting?: boolean;
}

// One loop is about 12.4s: four lines 1.4s apart, a short "writing" beat, the report, a hold, a fade.
const FRAMES: Frame[] = [
  { shown: 0, phase: 'recording', hold: 600 },
  { shown: 1, phase: 'recording', hold: 1400 },
  { shown: 2, phase: 'recording', hold: 1400 },
  { shown: 3, phase: 'recording', hold: 1400 },
  { shown: 4, phase: 'recording', hold: 1400 },
  { shown: 4, phase: 'writing', hold: 800 },
  { shown: 4, phase: 'saved', hold: 5000 },
  { shown: 0, phase: 'recording', hold: 400, resetting: true },
];
const FINAL = 6;

const reducedMotion = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Drives the mock with a single setTimeout chain. The full layout is always rendered;
 * frames only flip opacity/transform. Pauses off-screen and in hidden tabs, and stays on
 * the finished state when the visitor prefers reduced motion.
 */
function useMockLoop(ref: React.RefObject<HTMLElement>) {
  const [index, setIndex] = useState(FINAL);
  const [animating, setAnimating] = useState(false);

  useLayoutEffect(() => {
    if (!reducedMotion()) {
      setIndex(0);
      setAnimating(true);
    }
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let current = reducedMotion() ? FINAL : 0;
    let timer: number | undefined;
    let visible = false;

    const stop = () => {
      window.clearTimeout(timer);
      timer = undefined;
    };
    const schedule = () => {
      timer = window.setTimeout(() => {
        current = (current + 1) % FRAMES.length;
        setIndex(current);
        schedule();
      }, FRAMES[current].hold);
    };
    const update = () => {
      const run = visible && !document.hidden && !motion.matches;
      if (run && timer === undefined) schedule();
      else if (!run) stop();
    };
    const onMotionChange = () => {
      stop();
      current = motion.matches ? FINAL : 0;
      setIndex(current);
      setAnimating(!motion.matches);
      update();
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    observer.observe(el);
    document.addEventListener('visibilitychange', update);
    motion.addEventListener?.('change', onMotionChange);
    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
      motion.removeEventListener?.('change', onMotionChange);
    };
  }, [ref]);

  return { frame: FRAMES[index], animating };
}

const NAV_ICONS = [House, NotebookPen, Mic, FileText, ListChecks, CalendarDays];
const TIMES = ['00:04', '00:19', '00:31', '00:42'];

export const HeroMeetingMock: React.FC<{ copy: LandingCopy['mock'] }> = ({ copy }) => {
  const ref = useRef<HTMLDivElement>(null);
  const { frame, animating } = useMockLoop(ref);
  const { shown, phase } = frame;
  const speakers = [copy.you, copy.speaker2, copy.you, copy.speaker2];
  const reportShown = phase === 'saved';

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="hl-hm-root hl-mock relative"
      data-phase={phase}
      data-live={animating && phase === 'recording' ? 'true' : 'false'}
      data-resetting={frame.resetting ? 'true' : 'false'}
    >
      {/* Title bar */}
      <div className="hl-rule-b flex h-11 items-center justify-between gap-3 pl-4 pr-3">
        <div className="flex min-w-0 items-center gap-2 text-[12.5px]">
          <HuskyMark size={16} />
          <span className="hl-ink-3 hidden sm:inline">{copy.breadcrumbSection}</span>
          <span className="hl-ink-3 hidden sm:inline">/</span>
          <span className="hl-ink truncate font-medium">{copy.meetingTitle}</span>
        </div>
        <div className="hl-stack justify-items-end">
          <span className="hl-status-chip hl-hm-fade" data-shown={phase === 'recording'}>
            <span className="hl-rec-dot" />
            {copy.recording}
            <span className="hl-mono hl-ink-3">12:04</span>
          </span>
          <span className="hl-status-chip hl-hm-fade" data-shown={phase === 'writing'}>
            <PenLine size={12} strokeWidth={2} className="hl-accent" />
            {copy.writing}
          </span>
          <span className="hl-status-chip hl-hm-fade" data-shown={phase === 'saved'}>
            <Check size={12} strokeWidth={2.5} className="hl-ok" />
            {copy.saved}
          </span>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="hl-raised-2 hl-rule-r hidden w-[148px] flex-none flex-col justify-between p-2.5 sm:flex">
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {copy.nav.map((label, i) => {
              const Icon = NAV_ICONS[i];
              const active = i === 2;
              return (
                <li
                  key={label}
                  className={cx('flex h-8 items-center gap-2 rounded-[7px] px-2 text-[12.5px]', active ? 'hl-raised hl-ink font-medium' : 'hl-ink-2')}
                  style={active ? { boxShadow: '0 0 0 1px var(--hl-rule)' } : undefined}
                >
                  <Icon size={14} strokeWidth={1.75} className={active ? 'hl-accent' : 'hl-ink-3'} />
                  {label}
                </li>
              );
            })}
          </ul>
          <div className="hl-ink-2 mt-6 flex items-center gap-2 px-2 text-[12px]">
            <span className="hl-chip--accent inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold">
              {copy.profile.slice(0, 1)}
            </span>
            {copy.profile}
          </div>
        </div>

        {/* Meeting */}
        <div className="min-w-0 flex-1 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
          <p className="hl-ink m-0 text-[17px] font-semibold leading-tight tracking-[-0.01em]">{copy.meetingTitle}</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <span className="hl-tag hl-tag--xs">
              <AudioLines size={11} strokeWidth={2} className="hl-accent" />
              {copy.engine}
            </span>
            <span className="hl-tag hl-tag--xs">{copy.language}</span>
          </div>

          <ol className="m-0 mt-4 flex list-none flex-col gap-2.5 p-0">
            {copy.lines.map((line, i) => (
              <li key={i} className="hl-hm-line grid grid-cols-[38px_1fr] gap-2" data-shown={i < shown}>
                <span className="hl-mono hl-ink-3 pt-[2px] text-[11px]">{TIMES[i]}</span>
                <div className="min-w-0">
                  <span className={cx('block text-[11.5px] font-semibold', i % 2 === 0 ? 'hl-accent' : 'hl-ink')}>{speakers[i]}</span>
                  <span className="hl-ink-2 block text-[13px] leading-[1.45]" data-current={animating && phase === 'recording' && i === shown - 1}>
                    {line}
                    <span className="hl-caret" />
                  </span>
                </div>
              </li>
            ))}
          </ol>

          {/* Report */}
          <div className="hl-raised-2 hl-border mt-4 rounded-[10px] p-3 sm:p-3.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <span className="hl-ink inline-flex items-center gap-1.5 text-[12.5px] font-semibold">
                <FileText size={13} strokeWidth={2} className="hl-accent" />
                {copy.reportTitle}
              </span>
              <span className="hl-ink-3 text-[11px]">{copy.reportBy}</span>
            </div>
            <div className="hl-stack mt-3">
              <div className="hl-hm-fade flex flex-col gap-2.5 pt-1" data-shown={!reportShown}>
                <span className="hl-skeleton-bar w-[92%]" />
                <span className="hl-skeleton-bar w-[78%]" />
                <span className="hl-skeleton-bar w-[64%]" />
                <span className="hl-skeleton-bar w-[70%]" />
              </div>
              <dl className="hl-hm-fade m-0 grid grid-cols-[84px_1fr] gap-x-3 gap-y-2 text-[12.5px] leading-[1.45]" data-shown={reportShown}>
                <dt className="hl-mono hl-ink-3 text-[11px] leading-[18px]">{copy.summaryLabel}</dt>
                <dd className="hl-ink m-0">{copy.summary}</dd>
                <dt className="hl-mono hl-ink-3 text-[11px] leading-[18px]">{copy.decisionLabel}</dt>
                <dd className="hl-ink m-0">{copy.decision}</dd>
                <dt className="hl-mono hl-ink-3 text-[11px] leading-[18px]">{copy.actionLabel}</dt>
                <dd className="m-0 flex items-start gap-2">
                  <span className="hl-checkbox mt-[2px]" />
                  <span className="hl-ink">
                    {copy.action} <span className="hl-ink-3">· {copy.actionMeta}</span>
                  </span>
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
