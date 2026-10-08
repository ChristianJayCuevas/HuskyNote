/**
 * Exports: ThemeToggle
 *
 * Ghost icon button that flips light/dark (with the circular reveal from the click point).
 * ThemeToggle({ className? }). The topbar's Appearance menu offers Light / Dark / System instead.
 */
import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/theme-context';
import { useLanguage } from '../../context/language-context';
import { cn } from '@/lib/utils';
import { Button } from './button';

export const ThemeToggle: React.FC<{ className?: string }> = ({ className }) => {
  const { isDark, toggleTheme } = useTheme();
  const { t } = useLanguage();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={(e) => toggleTheme({ x: e.clientX, y: e.clientY })}
      className={cn('text-muted-foreground hover:text-foreground', className)}
      title={isDark ? `${t('theme.light')} mode` : `${t('theme.dark')} mode`}
      aria-label={t('theme.toggle')}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  );
};
