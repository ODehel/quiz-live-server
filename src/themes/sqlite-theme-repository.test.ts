import { beforeEach, describe, expect, it } from "vitest";
import { Theme } from "./theme.interface";
import { SqliteThemeRepository } from "./sqlite-theme-repository";
import { assert } from "node:console";

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

describe("US-004/CA-13 - Retrieve a list of themes with pagination", () => {
    let otherTheme: Theme;
    beforeEach(() => {
        otherTheme = {
            id: "019d979f-6a51-7c7c-879f-b2b8a20d8273",
            name: "Other theme test",
            created_at: new Date().toISOString(),
            last_updated_at: null
        };
        repository.insert(theme);
        repository.insert(otherTheme);
    });
    it("should give a list with the first theme", async () => {
        const themes: Theme[] = repository.getAll(0, 1);
        expect(themes.length).toBe(1);
    });
    it("should give a list with the second theme", async () => {
        const themes: Theme[] = repository.getAll(0, 2);
        expect(themes.length).toBe(2);
    });
});

describe("US-004/CA-14 - Retrieve a list of themes with pagination in the correct order", () => {
    let otherTheme: Theme;
    beforeEach(() => {
        otherTheme = {
            id: "019d979f-6a51-7c7c-879f-b2b8a20d8273",
            name: "Other theme test",
            created_at: new Date("2028-04-17 10:00:00").toISOString(),
            last_updated_at: null
        };
        repository.insert(theme);
        repository.insert(otherTheme);
    });
    it("should give a list with the first theme", async () => {
        const themes: Theme[] = repository.getAll(1, 1);
        expect(themes.length).toBe(1);
        expect(themes[0].name).toBe("Other theme test");
    });
    it("should give a list with the second theme", async () => {
        const themes: Theme[] = repository.getAll(2, 1);
        expect(themes.length).toBe(1);
        expect(themes[0].name).toBe("Theme test");
    });
});