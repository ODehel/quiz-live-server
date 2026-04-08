import { Theme } from "./theme.interface";

export interface ThemeRepository {
    count(): Promise<number>;
    insert(theme: Theme): Promise<void>;
    getById(id: string): Promise<Theme | undefined>;
}