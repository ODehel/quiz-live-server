import { ThemeRepository } from "../themes/theme-repository.interface";
import { ThemeExistenceChecker } from "./theme-existence-checker.interface";

export class ThemeRepositoryExistenceChecker implements ThemeExistenceChecker {
    constructor(private readonly repository: ThemeRepository) {
    }

    exists(themeId: string): boolean {
        return this.repository.getById(themeId) !== undefined;
    }
}
