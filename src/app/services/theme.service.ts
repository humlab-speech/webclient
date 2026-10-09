import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type Theme = 'light' | 'dark';

// Light/dark theme switch. The theme is the data-theme attribute on <html>,
// which the colour tokens in theme.scss key off. An explicit choice is kept in
// localStorage; without one the OS preference is followed, live.
//
// index.php applies the stored choice before Angular boots, so the page
// doesn't flash light first. Keep STORAGE_KEY in sync with that script.
@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  static readonly STORAGE_KEY = 'visp-theme';

  private media = window.matchMedia?.('(prefers-color-scheme: dark)');
  public theme$ = new BehaviorSubject<Theme>(this.resolveTheme());

  constructor() {
    this.apply(this.theme$.value);
    this.media?.addEventListener?.('change', () => {
      if(!this.storedTheme()) {
        this.set(this.systemTheme(), false);
      }
    });
  }

  get theme(): Theme {
    return this.theme$.value;
  }

  toggle() {
    this.set(this.theme === 'dark' ? 'light' : 'dark');
  }

  set(theme: Theme, remember = true) {
    if(remember) {
      try { localStorage.setItem(ThemeService.STORAGE_KEY, theme); } catch { /* storage blocked */ }
    }
    this.apply(theme);
    this.theme$.next(theme);
  }

  private apply(theme: Theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  private resolveTheme(): Theme {
    return this.storedTheme() ?? this.systemTheme();
  }

  private storedTheme(): Theme | null {
    try {
      const value = localStorage.getItem(ThemeService.STORAGE_KEY);
      return value === 'light' || value === 'dark' ? value : null;
    } catch {
      return null;
    }
  }

  private systemTheme(): Theme {
    return this.media?.matches ? 'dark' : 'light';
  }
}
