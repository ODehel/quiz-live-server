import { Theme } from "./theme.interface";

export interface ThemeRepository {
    count(): number;
    insert(theme: Theme): void;
    update(theme: Theme): void;
    delete(id: string): void;
    getAll(page: number, limit: number): Theme[];
    getById(id: string): Theme | undefined;
    getByName(name: string): Theme | undefined;
}