import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/theme-context';
import { useLanguage } from '../../context/language-context';

export const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { isDark, toggleTheme } = useTheme();
  const { t } = useLanguage();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    toggleTheme({ x: e.clientX, y: e.clientY });
  };

  return (
    <button
      onClick={handleClick}
      className={`p-1.5 sm:p-2 rounded-lg border transition-all duration-200 flex items-center justify-center ${
        isDark
          ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 dark:hover:bg-zinc-850 shadow-sm'
          : 'bg-white border-slate-200 text-slate-700 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50 shadow-sm'
      } ${className}`}
      title={isDark ? `${t('theme.light')} mode` : `${t('theme.dark')} mode`}
      aria-label={t('theme.toggle')}
    >
      {isDark ? (
        <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 transition-transform hover:rotate-45 duration-300" />
      ) : (
        <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600 transition-transform -hover:rotate-12 duration-300" />
      )}
    </button>
  );
};
