// The Språkbanken branding (logos, slogans, footer links) exists in Swedish
// and English, but the UI itself is English only, so the branding is too:
// following the browser language gave Swedish visitors a Swedish header on an
// English site. The Swedish variants are kept for when the UI is translated.
export type BrandLanguage = 'sv' | 'en';

export function brandLanguage(): BrandLanguage {
  return 'en';
}
