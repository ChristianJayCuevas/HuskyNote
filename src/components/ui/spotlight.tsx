import React, { useRef, useState, useCallback } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  enableTilt?: boolean;
}

export const SpotlightCard: React.FC<SpotlightCardProps> = ({
  children,
  className,
  enableTilt = true,
  ...props
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0, opacity: 0 });
  const [transform, setTransform] = useState('');

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setMousePos({ x, y, opacity: 1 });

      if (enableTilt && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -4; // Max 4 deg
        const rotateY = ((x - centerX) / centerX) * 4;
        setTransform(`perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`);
      }
    },
    [enableTilt]
  );

  const handleMouseLeave = useCallback(() => {
    setMousePos((prev) => ({ ...prev, opacity: 0 }));
    setTransform('');
  }, []);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ transform, transition: 'transform 0.2s ease-out' }}
      className={twMerge(
        clsx(
          'relative overflow-hidden bg-zinc-950 border dark:border-zinc-850 rounded-xl p-6 transition-colors duration-150',
          className
        )
      )}
      {...props}
    >
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity: mousePos.opacity,
          background: `radial-gradient(400px circle at ${mousePos.x}px ${mousePos.y}px, rgba(255, 255, 255, 0.05), transparent 80%)`,
        }}
        aria-hidden="true"
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
};
