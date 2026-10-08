import React from 'react';
import { ArrowRight } from 'lucide-react';

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

export const Container: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cx('mx-auto w-full max-w-[1120px] px-5 sm:px-8', className)}>{children}</div>
);

interface SectionProps {
  id: string;
  labelledBy: string;
  band?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** A full-width page band separated from its neighbours by a hairline. */
export const Section: React.FC<SectionProps> = ({ id, labelledBy, band, className, children }) => (
  <section id={id} aria-labelledby={labelledBy} tabIndex={-1} className={cx('hl-rule-t py-20 lg:py-28', band ? 'hl-band' : 'hl-bg', className)}>
    <Container>{children}</Container>
  </section>
);

interface SectionHeadingProps {
  id: string;
  eyebrow: string;
  title: string;
  lede?: string;
  className?: string;
}

export const SectionHeading: React.FC<SectionHeadingProps> = ({ id, eyebrow, title, lede, className }) => (
  <div className={cx('max-w-[640px]', className)}>
    <p className="hl-eyebrow">{eyebrow}</p>
    <h2 id={id} className="hl-h2 mt-4">
      {title}
    </h2>
    {lede && <p className="hl-lede mt-5">{lede}</p>}
  </div>
);

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface LButtonProps {
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  /** Renders an <a> for in-page links; otherwise a <button>. */
  href?: string;
  onClick?: (event: React.MouseEvent) => void;
  arrow?: boolean;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  'aria-label'?: string;
}

/** Landing-only button. Kept separate from the app's ui/button so the two can evolve independently. */
export const LButton: React.FC<LButtonProps> = ({ variant = 'primary', size = 'md', href, onClick, arrow, icon, className, children, ...rest }) => {
  const classes = cx('hl-btn', `hl-btn--${variant}`, size === 'sm' && 'hl-btn--sm', className);
  const content = (
    <>
      {icon}
      <span>{children}</span>
      {arrow && <ArrowRight className="hl-btn-arrow" size={16} strokeWidth={2} aria-hidden="true" />}
    </>
  );
  if (href) {
    return (
      <a href={href} onClick={onClick} className={classes} aria-label={rest['aria-label']}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={classes} aria-label={rest['aria-label']}>
      {content}
    </button>
  );
};

export const Chip: React.FC<{ children: React.ReactNode; accent?: boolean; className?: string }> = ({ children, accent, className }) => (
  <span className={cx('hl-chip', accent && 'hl-chip--accent', className)}>{children}</span>
);

/** A clean product frame for the code-built mocks (decorative; callers set aria-hidden). */
export const MockWindow: React.FC<{ title?: React.ReactNode; right?: React.ReactNode; className?: string; children: React.ReactNode }> = ({
  title,
  right,
  className,
  children,
}) => (
  <div className={cx('hl-mock', className)}>
    {(title || right) && (
      <div className="hl-rule-b flex h-10 items-center justify-between gap-3 px-4 text-[12px]">
        <div className="hl-ink-2 min-w-0 truncate font-medium">{title}</div>
        {right}
      </div>
    )}
    {children}
  </div>
);

/** A figure whose visual is decorative and whose caption carries the meaning. */
export const Figure: React.FC<{ caption?: string; className?: string; children: React.ReactNode }> = ({ caption, className, children }) => (
  <figure className={cx('m-0', className)}>
    {children}
    {caption && <figcaption className="hl-ink-3 mt-4 text-[13px] leading-[1.5]">{caption}</figcaption>}
  </figure>
);

export { cx };
