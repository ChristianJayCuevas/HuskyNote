import React, { useEffect, useRef } from 'react';

interface Node3D {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  baseAlpha: number;
  color: string;
}

interface NodeNetworkBackgroundProps {
  className?: string;
  nodeCount?: number;
  interactive?: boolean;
  mascotExclusionRef?: React.RefObject<HTMLElement | null>;
}

export const NodeNetworkBackground: React.FC<NodeNetworkBackgroundProps> = ({
  className = '',
  nodeCount,
  interactive = true,
  mascotExclusionRef,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameId = useRef<number>(0);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const count =
      nodeCount || (typeof window !== 'undefined' && window.innerWidth < 768 ? 32 : 65);

    const fov = 420;
    const maxZ = 250;
    const connectionDist = 130;

    const colors = [
      'rgba(255, 255, 255, ',
      'rgba(240, 240, 245, ',
      'rgba(161, 161, 170, ',
      'rgba(52, 211, 153, ', // emerald accent
    ];

    const nodes: Node3D[] = [];

    const resize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();

    // Initialize 3D nodes
    const boundX = width * 0.65;
    const boundY = height * 0.65;
    for (let i = 0; i < count; i++) {
      nodes.push({
        x: (Math.random() - 0.5) * boundX * 2,
        y: (Math.random() - 0.5) * boundY * 2,
        z: (Math.random() - 0.5) * maxZ * 2,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        vz: (Math.random() - 0.5) * 0.35,
        radius: Math.random() * 1.8 + 1.2,
        baseAlpha: Math.random() * 0.5 + 0.3,
        color: colors[Math.random() < 0.15 ? 3 : Math.floor(Math.random() * 3)],
      });
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!interactive) return;
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.targetX = (e.clientX - rect.left - width / 2) * 0.25;
      mouseRef.current.targetY = (e.clientY - rect.top - height / 2) * 0.25;
      mouseRef.current.active = true;
    };

    const handleMouseLeave = () => {
      mouseRef.current.targetX = 0;
      mouseRef.current.targetY = 0;
      mouseRef.current.active = false;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('resize', resize);

    // Mascot exclusion circle check (in screen space)
    const getMascotExclusion = () => {
      if (!mascotExclusionRef?.current) return null;
      const mascotRect = mascotExclusionRef.current.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      const cx = mascotRect.left - canvasRect.left + mascotRect.width / 2;
      const cy = mascotRect.top - canvasRect.top + mascotRect.height / 2;
      const radius = Math.max(mascotRect.width, mascotRect.height) * 0.55;
      return { cx, cy, radius };
    };

    let isVisible = true;
    const handleVisibility = () => {
      isVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Animation render loop
    const render = () => {
      if (!isVisible) {
        animFrameId.current = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // Smooth mouse lerp
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      const mascotEx = getMascotExclusion();
      const centerX = width / 2 + mouseRef.current.x;
      const centerY = height / 2 + mouseRef.current.y;

      const halfBoundX = width * 0.7;
      const halfBoundY = height * 0.7;

      // Project nodes to 2D
      const projected: Array<{
        px: number;
        py: number;
        scale: number;
        alpha: number;
        node: Node3D;
      }> = [];

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];

        // 3D displacement
        n.x += n.vx;
        n.y += n.vy;
        n.z += n.vz;

        // Soft 3D bounds bounce
        if (n.x < -halfBoundX) { n.x = -halfBoundX; n.vx *= -1; }
        if (n.x > halfBoundX) { n.x = halfBoundX; n.vx *= -1; }
        if (n.y < -halfBoundY) { n.y = -halfBoundY; n.vy *= -1; }
        if (n.y > halfBoundY) { n.y = halfBoundY; n.vy *= -1; }
        if (n.z < -maxZ) { n.z = -maxZ; n.vz *= -1; }
        if (n.z > maxZ) { n.z = maxZ; n.vz *= -1; }

        // Perspective projection formula
        const zDist = fov + n.z;
        const scale = fov / Math.max(10, zDist);
        const px = centerX + n.x * scale;
        const py = centerY + n.y * scale;

        // Mascot exclusion zone: fade out so nodes NEVER obstruct the husky mascot's face
        let alphaMod = 1;
        if (mascotEx) {
          const dx = px - mascotEx.cx;
          const dy = py - mascotEx.cy;
          const distToMascot = Math.sqrt(dx * dx + dy * dy);
          if (distToMascot < mascotEx.radius) {
            alphaMod = Math.max(0.04, (distToMascot / mascotEx.radius) * 0.3);
          }
        }

        const depthAlpha = Math.max(0.1, Math.min(1, (n.z + maxZ) / (maxZ * 2)));
        const finalAlpha = n.baseAlpha * depthAlpha * alphaMod;

        projected.push({
          px,
          py,
          scale,
          alpha: finalAlpha,
          node: n,
        });
      }

      // Draw connection lines
      for (let i = 0; i < projected.length; i++) {
        const p1 = projected[i];
        for (let j = i + 1; j < projected.length; j++) {
          const p2 = projected[j];
          const dx = p1.px - p2.px;
          const dy = p1.py - p2.py;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < connectionDist) {
            const lineFactor = 1 - dist / connectionDist;
            const lineAlpha = lineFactor * Math.min(p1.alpha, p2.alpha) * 0.35;

            // Don't draw harsh lines through mascot face
            let lineThroughMascot = false;
            if (mascotEx) {
              const midX = (p1.px + p2.px) / 2;
              const midY = (p1.py + p2.py) / 2;
              const dMid = Math.sqrt(
                (midX - mascotEx.cx) * (midX - mascotEx.cx) +
                  (midY - mascotEx.cy) * (midY - mascotEx.cy)
              );
              if (dMid < mascotEx.radius * 0.75) {
                lineThroughMascot = true;
              }
            }

            if (!lineThroughMascot && lineAlpha > 0.01) {
              ctx.beginPath();
              ctx.moveTo(p1.px, p1.py);
              ctx.lineTo(p2.px, p2.py);
              ctx.strokeStyle = `rgba(220, 220, 230, ${lineAlpha})`;
              ctx.lineWidth = Math.max(0.4, lineFactor * 1.2 * p1.scale);
              ctx.stroke();
            }
          }
        }
      }

      // Draw nodes with subtle glow halos
      for (let i = 0; i < projected.length; i++) {
        const p = projected[i];
        const r = Math.max(0.8, p.node.radius * p.scale);

        // Ambient glow halo for foreground nodes
        if (p.scale > 0.95 && p.alpha > 0.25) {
          ctx.beginPath();
          ctx.arc(p.px, p.py, r * 2.8, 0, Math.PI * 2);
          ctx.fillStyle = `${p.node.color}${p.alpha * 0.15})`;
          ctx.fill();
        }

        // Main node core
        ctx.beginPath();
        ctx.arc(p.px, p.py, r, 0, Math.PI * 2);
        ctx.fillStyle = `${p.node.color}${p.alpha})`;
        ctx.fill();
      }

      animFrameId.current = requestAnimationFrame(render);
    };

    animFrameId.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrameId.current);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [nodeCount, interactive, mascotExclusionRef]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      style={{ opacity: 0.95 }}
    />
  );
};
