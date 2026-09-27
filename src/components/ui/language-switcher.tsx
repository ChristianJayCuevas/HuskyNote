import React, { useState, useRef, useEffect } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { useLanguage, type LanguageCode } from '../../context/language-context';
import { useTheme } from '../../context/theme-context';

export const LanguageSwitcher: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { language, setLanguage, languages, t } = useLanguage();
  const { isDark } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const currentOption = languages.find((l) => l.code === language) || languages[0];

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all duration-200 ${
          isDark
            ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700 dark:hover:bg-zinc-850 shadow-sm'
            : 'bg-white border-slate-200 text-slate-700 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50 shadow-sm'
        }`}
        title={t('language.select')}
        aria-label={t('language.select')}
        aria-expanded={isOpen}
      >
        <Globe className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-400 shrink-0" />
        <span className="font-mono text-[11px] uppercase tracking-wider">{currentOption.code}</span>
        <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          className={`absolute right-0 mt-1.5 w-36 rounded-xl border p-1 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 ${
            isDark
              ? 'bg-zinc-950 border-zinc-800 text-zinc-200 dark:divide-zinc-850'
              : 'bg-white border-slate-200 text-slate-800 divide-slate-100 shadow-slate-200/50'
          }`}
        >
          {languages.map((item) => {
            const isSelected = item.code === language;
            return (
              <button
                key={item.code}
                onClick={() => {
                  setLanguage(item.code);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left ${
                  isSelected
                    ? isDark
                      ? 'bg-zinc-900 text-white font-semibold'
                      : 'bg-slate-100 text-slate-900 font-semibold'
                    : isDark
                    ? 'hover:bg-zinc-900/60 hover:text-zinc-100 text-zinc-400'
                    : 'hover:bg-slate-50 hover:text-slate-900 text-slate-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-zinc-500 uppercase">{item.code}</span>
                  <span>{item.nativeLabel}</span>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
