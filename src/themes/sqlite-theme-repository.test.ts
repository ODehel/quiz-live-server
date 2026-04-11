import { beforeEach, describe, expect, it } from "vitest";
import { Theme } from "./theme.interface";
import { SqliteThemeRepository } from "./sqlite-theme-repository";

let repository: SqliteThemeRepository;
let theme: Theme;
beforeEach(() => {
    repository = new SqliteThemeRepository(":memory:");
    theme = {
            id: "019d6c17-1c08-7161-9358-fe4a116fa388",
            name: "Theme test",
            created_at: new Date().toISOString(),
            last_updated_at: null
        };
});

describe("US-004/CA-001 - SqliteThemeRepository.getById(theme)", () => {
    it("should return the theme with the specified ID", async () => {
        // Arrange
        repository.insert(theme);
        // Act  
        const searchedTheme = repository.getById(theme.id);
        // Assert
        expect(searchedTheme?.id).toBe(theme.id);
        expect(searchedTheme?.name).toBe(theme.name);
        expect(searchedTheme?.created_at).toBe(theme.created_at);
        expect(searchedTheme?.last_updated_at).toBe(theme.last_updated_at);
    });
});

describe("US-004/CA-001 - SqliteThemeRepository.insert(theme)", () => {
    it("should create the themes table if it does not exist", async () => {
        const count = repository.count();
        // Assert
        expect(count).toBe(0);
    });
    it("should insert a theme into the database", async () => {
        // Act
        repository.insert(theme);
        // Assert
        const count = repository.count();
        expect(count).toBe(1);
    });
});

describe("US-004/CA-04 - Case insensitive for getById", () => {
    it("should return the theme even if the case is different", async () => {
        repository.insert(theme);
        const existingTheme = repository.getByName("ThEmE tEsT");
        // Assert
        expect(existingTheme).not.toBeUndefined();
    });
});