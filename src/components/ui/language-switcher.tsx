/**
 * Exports: LanguageSwitcher
 *
 * LanguageSwitcher({ className? }): ghost sm button (Globe + language code) opening a DropdownMenu
 * with one radio item per language.
 */
import React from 'react';
import { ChevronDown, Globe } from 'lucide-react';
import { useLanguage, type LanguageCode } from '../../context/language-context';
import { cn } from '@/lib/utils';
import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from './dropdown-menu';

export const LanguageSwitcher: React.FC<{ className?: string }> = ({ className }) => {
  const { language, setLanguage, languages, t } = useLanguage();
  const currentOption = languages.find((l) => l.code === language) || languages[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn('text-muted-foreground hover:text-foreground', className)}
          title={t('language.select')}
          aria-label={t('language.select')}
        >
          <Globe />
          <span className="uppercase">{currentOption.code}</span>
          <ChevronDown className="size-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>{t('language.select')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={language} onValueChange={(value) => setLanguage(value as LanguageCode)}>
          {languages.map((item) => (
            <DropdownMenuRadioItem key={item.code} value={item.code}>
              <span className="flex-1">{item.nativeLabel}</span>
              <span className="text-xs uppercase text-muted-foreground">{item.code}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
