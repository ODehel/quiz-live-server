import { Pagination } from "../common/pagination.interface";
import { Theme } from "./theme.interface";

export interface ThemeService {
    createTheme(name: string): Theme;
    updateTheme(id: string, name: string): Theme;
    deleteTheme(id: string): void;
    getAll(page: number, limit: number): Pagination<Theme>;
    getById(id: string): Theme | undefined;
}