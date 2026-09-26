import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import enTranslations from '../locales/en.json';
import zhTranslations from '../locales/zh.json';
import jaTranslations from '../locales/ja.json';
import frTranslations from '../locales/fr.json';

export type LanguageCode = 'en' | 'zh' | 'ja' | 'fr';

export interface LanguageOption {
  code: LanguageCode;
  label: string;
  nativeLabel: string;
}

export const AVAILABLE_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'zh', label: 'Chinese', nativeLabel: '中文' },
  { code: 'ja', label: 'Japanese', nativeLabel: '日本語' },
  { code: 'fr', label: 'French', nativeLabel: 'Français' },
];

const TRANSLATION_MAP: Record<LanguageCode, any> = {
  en: enTranslations,
  zh: zhTranslations,
  ja: jaTranslations,
  fr: frTranslations,
};

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (path: string, fallback?: string) => string;
  languages: LanguageOption[];
}

const LanguageContext = createContext<LanguageContextType | null>(null);

function resolveDotPath(obj: any, path: string): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    if (typeof window === 'undefined') return 'en';
    const stored = localStorage.getItem('huskynote_language') as LanguageCode;
    if (stored && ['en', 'zh', 'ja', 'fr'].includes(stored)) {
      return stored;
    }
    return 'en';
  });

  const setLanguage = useCallback((lang: LanguageCode) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('huskynote_language', lang);
      document.documentElement.lang = lang;
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

  const t = useCallback(
    (path: string, fallback?: string): string => {
      const targetDict = TRANSLATION_MAP[language];
      const translated = resolveDotPath(targetDict, path);
      if (translated !== undefined) return translated;

      // Fallback to English
      const enTranslated = resolveDotPath(enTranslations, path);
      if (enTranslated !== undefined) return enTranslated;

      return fallback ?? path;
    },
    [language]
  );

  const contextValue = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      languages: AVAILABLE_LANGUAGES,
    }),
    [language, setLanguage, t]
  );

  return <LanguageContext.Provider value={contextValue}>{children}</LanguageContext.Provider>;
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
