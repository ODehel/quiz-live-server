import { Clock } from "../common/clock.interface";
import { UuidGenerator } from "../common/uuid-generator.interface";
import { ThemeService } from "./theme-service.interface";

export class DefaultThemeService implements ThemeService {
    constructor(private clock: Clock, private uuidGenerator: UuidGenerator) {}

    createTheme(name: string) {
        return {
            id: this.uuidGenerator.generate(),
            name,
            created_at: this.clock.now().toISOString(),
            last_updated_at: null,
        };
    }
}