import { Clock } from "../common/clock.interface";
import { UuidGenerator } from "../common/uuid-generator.interface";
import { ThemeRepository } from "./theme-repository.interface";
import { ThemeService } from "./theme-service.interface";
import { Theme } from "./theme.interface";

export class DefaultThemeService implements ThemeService {
    constructor(private clock: Clock, private uuidGenerator: UuidGenerator, private themeRepository: ThemeRepository) {}

    createTheme(name: string) : Theme {
        const theme: Theme = {
            id: this.uuidGenerator.generate(),
            name: this.trimBlanks(name),
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