import { useMemo } from 'react';
import { useLanguage } from '../../context/language-context';
import { LANDING_COPY, mapCopy, type LandingCopy } from './copy';

/** The landing copy, with each string looked up as `home.<path>` in the active locale. */
export function useLandingCopy(): LandingCopy {
  const { t, language } = useLanguage();
  // t changes identity with the language; both are listed so the memo is explicit.
  return useMemo(() => mapCopy(LANDING_COPY, (path, value) => t(path, value)), [t, language]);
}
