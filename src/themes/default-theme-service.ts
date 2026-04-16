import { Clock } from "../common/clock.interface";
import { UuidGenerator } from "../common/uuid-generator.interface";
import { ConflictError } from "./conflict-error";
import { ThemeRepository } from "./theme-repository.interface";
import { ThemeService } from "./theme-service.interface";
import { Theme } from "./theme.interface";
import { ValidationError } from "./validation-error";

export class DefaultThemeService implements ThemeService {
    constructor(private clock: Clock, private uuidGenerator: UuidGenerator, private themeRepository: ThemeRepository) { }
    
    getById(id: string): Theme | undefined {
        return this.themeRepository.getById(id);
    }

    createTheme(name: string): Theme {
        const trimmedName = this.trimBlanks(name);
        if (!/^[\p{Lu}][\p{L}\p{N} '\-]{1,38}[\p{L}\p{N}]$/u.test(trimmedName)) {
            throw new ValidationError();
        }

        if (this.themeRepository.getByName(trimmedName) !== undefined) {
            throw new ConflictError();
        }

        const theme: Theme = {
            id: this.uuidGenerator.generate(),
            name: trimmedName,
            created_at: this.clock.now().toISOString(),
            last_updated_at: null,
        };
        this.themeRepository.insert(theme);
        return theme;
    };

    private trimBlanks(name: string): string {
        return name.trim().replace(/\s+/g, ' ');
    }
}