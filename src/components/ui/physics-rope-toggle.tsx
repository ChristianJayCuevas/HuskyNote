import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useTheme } from '../../context/theme-context';
import { useSound } from '../../context/sound-context';

export const PhysicsRopeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();
  const { playThock, playPop } = useSound();

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Direct DOM refs for 120 FPS animation with 0 React re-renders
  const pathShadowRef = useRef<SVGPathElement>(null);
  const pathCoreRef = useRef<SVGPathElement>(null);
  const pathAccentRef = useRef<SVGPathElement>(null);
  const handleGroupRef = useRef<SVGGElement>(null);

  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Proportional Physics constants
  const NUM_POINTS = 9;
  const L_REST = 34;
  const L_EXTENDED_CLICK = 65;
  const L_MAX_DRAG = 100;
  const ANCHOR_X = 50;
  const ANCHOR_Y = 8;

  // Simulation state refs
  const phaseRef = useRef<'idle' | 'pulling' | 'recoiling' | 'dragging'>('idle');
  const isDraggingRef = useRef(false);
  const dragTargetRef = useRef({ x: ANCHOR_X, y: ANCHOR_Y + L_REST });
  const themeFiredRef = useRef(false);

  // Click timing: tap detection within 200ms
  const pointerDownTimeRef = useRef(0);
  const clickStartRef = useRef(0);
  const clickStartLenRef = useRef(ANCHOR_Y + L_REST);

  const pointsRef = useRef(
    Array.from({ length: NUM_POINTS }, (_, i) => ({
      x: ANCHOR_X,
      y: ANCHOR_Y + (i / (NUM_POINTS - 1)) * L_REST,
      vx: 0,
      vy: 0,
      waveX: 0,
      waveVx: 0,
    }))
  );

  // Fire theme switch immediately with origin coords for circular transition
  const fireThemeSwitch = useCallback(() => {
    if (themeFiredRef.current) return;
    themeFiredRef.current = true;

    try {
      playPop();
    } catch { /* audio optional */ }

    const rect = containerRef.current?.getBoundingClientRect();
    const origin = rect
      ? { x: rect.left + rect.width / 2, y: rect.bottom }
      : { x: window.innerWidth - 60, y: 60 };

    toggleTheme(origin);
  }, [toggleTheme, playPop]);

  const isSimulatingRef = useRef(false);
  const animIdRef = useRef<number>(0);
  const simulateRef = useRef<() => void>(() => {});

  const startSimulation = useCallback(() => {
    if (!isSimulatingRef.current) {
      isSimulatingRef.current = true;
      animIdRef.current = requestAnimationFrame(simulateRef.current);
    }
  }, []);

  // Physics simulation – direct DOM updates for lag-free 120 FPS
  useEffect(() => {
    const K_SPRING_Y = 0.28;
    const DAMPING_Y = 0.82;
    const K_PENDULUM_X = 0.10;
    const DAMPING_X = 0.93;

    const simulate = () => {
      const now = performance.now();
      const points = pointsRef.current;
      const lastIdx = NUM_POINTS - 1;
      const handle = points[lastIdx];

      points[0].x = ANCHOR_X;
      points[0].y = ANCHOR_Y;
      points[0].vx = 0;
      points[0].vy = 0;

      if (phaseRef.current === 'dragging') {
        const target = dragTargetRef.current;
        handle.vx = (target.x - handle.x) * 0.55;
        handle.vy = (target.y - handle.y) * 0.55;
        handle.x += handle.vx;
        handle.y += handle.vy;

        // Fire theme if dragged down far enough
        const pullDist = handle.y - (ANCHOR_Y + L_REST);
        if (pullDist > 22 && !themeFiredRef.current) {
          fireThemeSwitch();
        }
      } else if (phaseRef.current === 'pulling') {
        // Animated visual snap-pull after an instant tap
        const PULL_DURATION = 90;
        const elapsed = now - clickStartRef.current;
        const progress = Math.min(1, elapsed / PULL_DURATION);
        const ease = 1 - Math.pow(1 - progress, 2);

        handle.y = clickStartLenRef.current + (L_EXTENDED_CLICK - clickStartLenRef.current) * ease;
        handle.x = ANCHOR_X + Math.sin(progress * Math.PI) * 4;

        if (progress >= 1) {
          phaseRef.current = 'recoiling';
          handle.vy = -18;
          handle.vx = (Math.random() > 0.5 ? 1 : -1) * 6;
          for (let i = 1; i < lastIdx; i++) {
            const wave = Math.sin((i / NUM_POINTS) * Math.PI * 2) * 6;
            points[i].waveVx = (i % 2 === 0 ? 1 : -1) * wave;
          }
        }
      } else {
        // Recoil & Idle spring physics
        const dispY = handle.y - (ANCHOR_Y + L_REST);
        const springForceY = -K_SPRING_Y * dispY;
        handle.vy = (handle.vy + springForceY) * DAMPING_Y;
        handle.y += handle.vy;

        // Lateral pendulum swing
        const dispX = handle.x - ANCHOR_X;
        const pendForceX = -K_PENDULUM_X * dispX;
        handle.vx = (handle.vx + pendForceX) * DAMPING_X;
        handle.x += handle.vx;

        // Settle near rest
        if (
          Math.abs(dispY) < 0.15 && Math.abs(handle.vy) < 0.15 &&
          Math.abs(dispX) < 0.15 && Math.abs(handle.vx) < 0.15
        ) {
          handle.y = ANCHOR_Y + L_REST;
          handle.x = ANCHOR_X;
          handle.vy = 0;
          handle.vx = 0;
          phaseRef.current = 'idle';
        }
      }

      // Catagorical rope curve calculation
      for (let i = 1; i < lastIdx; i++) {
        const t = i / lastIdx;
        const idealX = ANCHOR_X + (handle.x - ANCHOR_X) * t;
        const idealY = ANCHOR_Y + (handle.y - ANCHOR_Y) * t;

        // Wave propagation
        points[i].waveVx = (points[i].waveVx - points[i].waveX * 0.18) * 0.88;
        points[i].waveX += points[i].waveVx;

        points[i].x = idealX + points[i].waveX;
        points[i].y = idealY;
      }

      // Render smooth SVG quadratic path
      let d = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        d += ` Q ${points[i].x} ${points[i].y}, ${xc} ${yc}`;
      }
      d += ` L ${handle.x} ${handle.y}`;

      if (pathCoreRef.current) pathCoreRef.current.setAttribute('d', d);
      if (pathShadowRef.current) pathShadowRef.current.setAttribute('d', d);
      if (pathAccentRef.current) pathAccentRef.current.setAttribute('d', d);

      // Handle orientation angle following rope tangent
      const prevPt = points[lastIdx - 1];
      const angleRad = Math.atan2(handle.y - prevPt.y, handle.x - prevPt.x) - Math.PI / 2;
      const angleDeg = (angleRad * 180) / Math.PI;
      const clampedAngle = Math.max(-30, Math.min(30, angleDeg));

      if (handleGroupRef.current) {
        handleGroupRef.current.setAttribute(
          'transform',
          `translate(${handle.x}, ${handle.y}) rotate(${clampedAngle})`
        );
      }

      // Sleep simulation when idle to free CPU/GPU cycles
      if (phaseRef.current === 'idle') {
        isSimulatingRef.current = false;
        animIdRef.current = 0;
        return;
      }

      animIdRef.current = requestAnimationFrame(simulate);
    };

    simulateRef.current = simulate;
    isSimulatingRef.current = true;
    animIdRef.current = requestAnimationFrame(simulate);

    return () => {
      isSimulatingRef.current = false;
      if (animIdRef.current) {
        cancelAnimationFrame(animIdRef.current);
      }
    };
  }, [fireThemeSwitch]);

  // Pointer interaction
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

    pointerDownTimeRef.current = performance.now();
    themeFiredRef.current = false;
    isDraggingRef.current = true;
    setIsDragging(true);
    phaseRef.current = 'dragging';
    startSimulation();

    try {
      playThock(1.1);
    } catch { /* audio optional */ }

    const svg = svgRef.current;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());

    dragTargetRef.current = {
      x: Math.max(ANCHOR_X - 25, Math.min(ANCHOR_X + 25, svgP.x)),
      y: Math.max(ANCHOR_Y + L_REST, Math.min(ANCHOR_Y + L_MAX_DRAG, svgP.y)),
    };
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDraggingRef.current) return;
    const svg = svgRef.current;
    if (!svg) return;

    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());

    dragTargetRef.current = {
      x: Math.max(ANCHOR_X - 25, Math.min(ANCHOR_X + 25, svgP.x)),
      y: Math.max(ANCHOR_Y + L_REST, Math.min(ANCHOR_Y + L_MAX_DRAG, svgP.y)),
    };
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDraggingRef.current) return;
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch { /* ignore */ }

    isDraggingRef.current = false;
    setIsDragging(false);

    const pressDuration = performance.now() - pointerDownTimeRef.current;
    const handle = pointsRef.current[NUM_POINTS - 1];
    const pullDist = handle.y - (ANCHOR_Y + L_REST);

    if (pressDuration < 220 || pullDist < 12) {
      // Tap detected -> snap animation & toggle theme
      clickStartRef.current = performance.now();
      clickStartLenRef.current = handle.y;
      phaseRef.current = 'pulling';
      fireThemeSwitch();
    } else {
      // Drag released -> spring recoil
      phaseRef.current = 'recoiling';
      handle.vy = -16;
      handle.vx = (handle.x - ANCHOR_X) * 0.3;
    }
    startSimulation();
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (phaseRef.current === 'idle') {
      const handle = pointsRef.current[NUM_POINTS - 1];
      handle.vx += (Math.random() > 0.5 ? 1 : -1) * 2.5;
      phaseRef.current = 'recoiling';
      startSimulation();
    }
  };

  const isDark = theme === 'dark';

  return (
    <div
      ref={containerRef}
      className={`relative select-none touch-none pointer-events-none ${className}`}
      title={`Pull cord: Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
      aria-label="Physics pull-cord lampshade switch under appbar"
    >
      {/* The 72x130 box hangs over page content, so only the handle takes pointer events */}
      <div className="relative w-[72px] h-[130px]">
        <svg
          ref={svgRef}
          className="w-full h-full overflow-visible block pointer-events-none"
          viewBox="0 0 100 150"
          preserveAspectRatio="xMidYMin meet"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          <defs>
            <linearGradient id="ropeFixtureMetal" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor={isDark ? '#3f3f46' : '#64748b'} />
              <stop offset="35%"  stopColor={isDark ? '#52525b' : '#94a3b8'} />
              <stop offset="65%"  stopColor={isDark ? '#71717a' : '#cbd5e1'} />
              <stop offset="100%" stopColor={isDark ? '#3f3f46' : '#64748b'} />
            </linearGradient>
            <linearGradient id="ropeBellMetal" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor={isDark ? '#f4f4f5' : '#1e293b'} />
              <stop offset="50%"  stopColor={isDark ? '#d4d4d8' : '#0f172a'} />
              <stop offset="100%" stopColor={isDark ? '#a1a1aa' : '#020617'} />
            </linearGradient>
          </defs>

          {/* ONE-PIECE MOUNTING FIXTURE – clamped flush against the appbar bottom border */}
          <g>
            {/* Top flush plate (y=0, sits precisely on the 1px bottom border) */}
            <path
              d="M 22 0 L 78 0 C 78 3.5 72 4 66 4 L 34 4 C 28 4 22 3.5 22 0 Z"
              fill="url(#ropeFixtureMetal)"
            />
            {/* Screw rivets */}
            <circle cx="33" cy="2" r="1.2" fill={isDark ? '#18181b' : '#334155'} />
            <circle cx="67" cy="2" r="1.2" fill={isDark ? '#18181b' : '#334155'} />
            {/* Tapered collar */}
            <path
              d="M 43 4 L 57 4 L 54 8.5 L 46 8.5 Z"
              fill={isDark ? '#52525b' : '#94a3b8'}
              stroke={isDark ? '#27272a' : '#64748b'}
              strokeWidth="0.5"
            />
            {/* Eyelet grommet */}
            <circle cx="50" cy="8.5" r="2.6" fill={isDark ? '#27272a' : '#64748b'} />
            <circle cx="50" cy="8.5" r="1.3" fill={isDark ? '#09090b' : '#1e293b'} />
          </g>

          {/* Rope shadow */}
          <path
            ref={pathShadowRef}
            stroke={isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.12)'}
            strokeWidth="3.2"
            strokeLinecap="round"
            fill="none"
            transform="translate(1,2)"
          />

          {/* Rope core */}
          <path
            ref={pathCoreRef}
            stroke={isDark ? '#71717a' : '#64748b'}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          {/* Rope braided accent */}
          <path
            ref={pathAccentRef}
            stroke={isDark ? '#f4f4f5' : '#1e293b'}
            strokeWidth="0.9"
            strokeDasharray="2.5 3.5"
            strokeLinecap="round"
            fill="none"
            opacity={isDark ? 0.7 : 0.35}
          />

          {/* Bell handle group – moved by physics via direct DOM */}
          <g
            ref={handleGroupRef}
            transform={`translate(${ANCHOR_X}, ${ANCHOR_Y + L_REST}) rotate(0)`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={() => setIsHovered(false)}
            style={{
              pointerEvents: 'auto',
              filter: isHovered || isDragging
                ? 'drop-shadow(0 4px 10px rgba(0,0,0,0.35))'
                : 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
              transition: 'filter 0.15s ease',
            }}
          >
            {/* Hit target covering the bell and the DARK / LIGHT badge */}
            <rect x="-22" y="-4" width="44" height="37" fill="transparent" pointerEvents="all" />

            {/* Ring collar */}
            <rect x="-3" y="-1" width="6" height="3" rx="1"
              fill={isDark ? '#a1a1aa' : '#475569'} />

            {/* Bell body */}
            <path
              d="M -5.5 2 L 5.5 2 L 7 14 C 7 18.5 -7 18.5 -7 14 Z"
              fill="url(#ropeBellMetal)"
              stroke={isDark ? '#52525b' : '#334155'}
              strokeWidth="1.1"
            />
            {/* Center groove */}
            <rect x="-1.8" y="4.5" width="3.6" height="6" rx="0.8"
              fill={isDark ? '#18181b' : '#ffffff'} opacity="0.85" />
            <circle cx="0" cy="15" r="1.5" fill={isDark ? '#27272a' : '#cbd5e1'} />

            {/* DARK / LIGHT badge with high contrast in both modes */}
            <g transform="translate(0, 24)">
              <rect
                x="-21" y="-8" width="42" height="16" rx="8"
                fill={isDark ? '#f8fafc' : '#09090b'}
                stroke={isDark ? '#cbd5e1' : '#27272a'}
                strokeWidth="1.2"
                style={{
                  filter: isHovered || isDragging
                    ? (isDark ? 'drop-shadow(0 2px 8px rgba(255,255,255,0.45))' : 'drop-shadow(0 2px 8px rgba(0,0,0,0.35))')
                    : 'drop-shadow(0 1px 3px rgba(0,0,0,0.2))',
                }}
              />
              <text
                x="0" y="3"
                textAnchor="middle"
                fill={isDark ? '#09090b' : '#ffffff'}
                fontSize="7"
                fontWeight="800"
                fontFamily="system-ui, -apple-system, sans-serif"
                letterSpacing="0.12em"
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                {isDark ? 'LIGHT' : 'DARK'}
              </text>
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
};
