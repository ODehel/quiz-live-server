import { Theme } from "./theme.interface";

export interface ThemeRepository {
    count(): number;
    insert(theme: Theme): void;
    getById(id: string): Theme | undefined;
    getByName(name: string): Theme | undefined;
}