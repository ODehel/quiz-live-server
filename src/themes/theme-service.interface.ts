import { Theme } from "./theme.interface";

export interface ThemeService {
    createTheme(name: string) : Theme;
}