import { Theme } from "./theme.interface";

export interface ThemeService {
    createTheme(name: string) : Theme;
    getById(id: string) : Theme | undefined;
}