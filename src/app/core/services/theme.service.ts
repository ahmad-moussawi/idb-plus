import { Injectable, signal } from '@angular/core';

export type AppTheme = 'dark' | 'light' | 'auto';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  readonly currentTheme = signal<'dark' | 'light'>('dark');
  readonly themeMode = signal<AppTheme>('auto');

  constructor() {
    this.initTheme();
  }

  private initTheme(): void {
    // 1. Check Chrome DevTools theme if available
    const chromeApi = (window as any).chrome;
    if (chromeApi?.devtools?.panels) {
      const devtoolsTheme = chromeApi.devtools.panels.themeName;
      if (devtoolsTheme) {
        this.applyTheme(devtoolsTheme === 'dark' ? 'dark' : 'light');
      }

      chromeApi.devtools.panels.onThemeChanged?.addListener((theme: string) => {
        if (this.themeMode() === 'auto') {
          this.applyTheme(theme === 'dark' ? 'dark' : 'light');
        }
      });
      return;
    }

    // 2. Check local storage preference
    const saved = localStorage.getItem('idb_plus_theme') as AppTheme | null;
    if (saved && (saved === 'dark' || saved === 'light')) {
      this.themeMode.set(saved);
      this.applyTheme(saved);
      return;
    }

    // 3. Fallback to system preference (defaulting to dark if preferred, else dark as primary devtools default)
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    this.applyTheme(prefersDark ? 'dark' : 'light');

    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (this.themeMode() === 'auto') {
        this.applyTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  toggleTheme(): void {
    const next = this.currentTheme() === 'dark' ? 'light' : 'dark';
    this.themeMode.set(next);
    localStorage.setItem('idb_plus_theme', next);
    this.applyTheme(next);
  }

  private applyTheme(theme: 'dark' | 'light'): void {
    this.currentTheme.set(theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }
}
