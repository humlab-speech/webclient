// The UI itself is English, but the Språkbanken branding (logos, slogans,
// footer links) comes in Swedish and English; pick it from the browser language.
export type BrandLanguage = 'sv' | 'en';

export function brandLanguage(): BrandLanguage {
  const language = (typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en').toLowerCase();
  return language.startsWith('sv') ? 'sv' : 'en';
}
