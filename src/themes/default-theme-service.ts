import { Clock } from "../common/clock.interface";
import { Pagination } from "../common/pagination.interface";
import { UuidGenerator } from "../common/uuid-generator.interface";
import { ConflictError } from "./conflict-error";
import { ThemeNotFoundError } from "./theme-not-found-error";
import { ThemeRepository } from "./theme-repository.interface";
import { ThemeService } from "./theme-service.interface";
import { Theme } from "./theme.interface";
import { ValidationError } from "./validation-error";

export class DefaultThemeService implements ThemeService {
    constructor(private clock: Clock, private uuidGenerator: UuidGenerator, private themeRepository: ThemeRepository) { }

    getAll(page: number, limit: number): Pagination<Theme> {
        const themes: Theme[] = this.themeRepository.getAll(page, limit);
        const total: number = this.themeRepository.count();
        const pagination: Pagination<Theme> = {
            data: themes,
            limit: limit,
            page: page,
            total: total,
            total_pages: Math.ceil(total / limit)
        };
        return pagination;
    }

    getById(id: string): Theme | undefined {
        return this.themeRepository.getById(id);
    }

    createTheme(name: string): Theme {
        const trimmedName = this.formatName(name);

        const theme: Theme = {
            id: this.uuidGenerator.generate(),
            name: trimmedName,
            created_at: this.clock.now().toISOString(),
            last_updated_at: null,
        };
        this.themeRepository.insert(theme);
        return theme;
    };

    updateTheme(id: string, name: string): Theme {
        const theme = this.themeRepository.getById(id);

        if (theme === undefined) {
            throw new ThemeNotFoundError();
        }
        const trimmedName = this.formatName(name);
        if (trimmedName.localeCompare(theme.name, undefined, { sensitivity: 'base' }) === 0) {
            return theme;
        }

        theme.name = trimmedName;
        theme.last_updated_at = this.clock.now().toISOString();
        this.themeRepository.update(theme);
        return theme;
    }

    deleteTheme(id: string): void {
        this.themeRepository.delete(id);
    }

    private trimBlanks(name: string): string {
        return name.trim().replace(/\s+/g, ' ');
    }

    private formatName(name: string) {
        const trimmedName = this.trimBlanks(name);
        if (!/^[\p{Lu}][\p{L}\p{N} '\-]{1,38}[\p{L}\p{N}]$/u.test(trimmedName)) {
            throw new ValidationError();
        }

        if (this.themeRepository.getByName(trimmedName) !== undefined) {
            throw new ConflictError();
        }
        return trimmedName;
    }
}