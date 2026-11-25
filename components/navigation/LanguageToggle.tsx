'use client';

import { useLanguage } from '@/components/providers/LanguageProvider';
import { Button } from '@/components/ui/button';
import { Languages } from 'lucide-react';

interface LanguageToggleProps {
  compact?: boolean;
  className?: string;
}

export function LanguageToggle({ compact = false, className = '' }: LanguageToggleProps) {
  const { lang, toggleLang } = useLanguage();

  if (compact) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={toggleLang}
        aria-label="Toggle Language (English / Hindi)"
        className={`h-9 px-2.5 text-xs font-bold gap-1.5 border-border ${className}`}
      >
        <Languages className="h-3.5 w-3.5 text-primary" />
        <span>{lang === 'en' ? 'EN' : 'हिं'}</span>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={toggleLang}
      className={`w-full h-10 justify-between px-3 text-xs font-semibold border-border ${className}`}
    >
      <span className="flex items-center gap-2 text-muted-foreground">
        <Languages className="h-4 w-4 text-primary" />
        <span>{lang === 'en' ? 'Language' : 'भाषा'}</span>
      </span>
      <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">
        {lang === 'en' ? 'EN → हिंदी' : 'हिंदी → EN'}
      </span>
    </Button>
  );
}
