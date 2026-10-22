import { ELIS_TOKENS } from './tokens';
export type ElisThemeMode = 'dark' | 'light';
export class ThemeManager {
    private currentMode: ElisThemeMode = 'dark';
    public getTheme(): ElisThemeMode {
        return this.currentMode;
    }
    public setTheme(mode: ElisThemeMode): void {
        this.currentMode = mode;
        if (typeof document !== 'undefined') {
            if (mode === 'dark') {
                document.documentElement.classList.add('dark');
                document.documentElement.classList.remove('light');
                document.documentElement.setAttribute('data-theme', 'dark');
            }
            else {
                document.documentElement.classList.add('light');
                document.documentElement.classList.remove('dark');
                document.documentElement.setAttribute('data-theme', 'light');
            }
        }
    }
    public getColors() {
        return this.currentMode === 'dark' ? ELIS_TOKENS.colors.dark : ELIS_TOKENS.colors.light;
    }
}
export const defaultThemeManager = new ThemeManager();
