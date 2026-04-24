import { afterEach, assert, beforeEach, describe, expect, it, vi } from "vitest";
import { Clock } from "../common/clock.interface";
import { UuidGenerator } from "../common/uuid-generator.interface";
import { DefaultThemeService } from "./default-theme-service";
import { Theme } from "./theme.interface";
import { ThemeRepository } from "./theme-repository.interface";
import { ValidationError } from "./validation-error";
import { ConflictError } from "./conflict-error";
import { Pagination } from "../common/pagination.interface";
import { ThemeNotFoundError } from "./theme-not-found-error";
import { ThemeHasQuestionsError } from "./theme-has-questions-error";

let clock: Clock;
let uuidGenerator: UuidGenerator;
let themeRepository: ThemeRepository;
let defaultThemeService: DefaultThemeService;

beforeEach(() => {
    clock = { now: vi.fn().mockReturnValue(new Date("2026-04-08T13:32:00Z")) };
    uuidGenerator = { generate: vi.fn().mockReturnValue("019d6cdd-30db-7437-ac57-5826c0695222") };
    themeRepository = {
        count: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        getById: vi.fn(),
        getByName: vi.fn(),
        getAll: vi.fn(),
        isUsedInQuestions: vi.fn()
    };
    defaultThemeService = new DefaultThemeService(clock, uuidGenerator, themeRepository);
});

describe("US-004/CA-001 - When the service is called to create a theme", () => {
    let theme: Theme;
    beforeEach(() => {
        theme = defaultThemeService.createTheme("Test Theme");
    });
    it("should create a theme with the provided name and the current date as creation date", () => {
        assert.equal(theme.id, uuidGenerator.generate());
        assert.equal(theme.name, "Test Theme");
        assert.equal(theme.created_at, clock.now().toISOString());
        assert.isNull(theme.last_updated_at);
    });
    it("should call the create from repository with the created theme", () => {
        assert.equal(uuidGenerator.generate, uuidGenerator.generate);
        assert.equal(clock.now, clock.now);
        expect(themeRepository.insert).toHaveBeenCalledWith(theme);
    });
});

describe("US-004/CA-002 - When the service is called to create a theme with blank spaces in the name", () => {
    let theme: Theme;
    beforeEach(() => {
        theme = defaultThemeService.createTheme("  Test   Theme  With  Spaces  ");
    });
    it("should create a theme with the provided name and the current date as creation date", () => {
        assert.equal(theme.id, uuidGenerator.generate());
        assert.equal(theme.name, "Test Theme With Spaces");
        assert.equal(theme.created_at, clock.now().toISOString());

        assert.isNull(theme.last_updated_at);
    });
});

describe("US-004/CA-003 - When the service is called to create a theme with a name that doesn't respect the regex", () => {
    it("should throw a validation error", () => {
        expect(() => defaultThemeService.createTheme("Invalid@Name!")).toThrow(ValidationError);
    });
});

describe("US-004/CA-004 - When the service is called to create a theme with a name that already exists", () => {
    beforeEach(() => {
        themeRepository.getByName = vi.fn().mockReturnValue({ id: "existing-id", name: "Existing Theme", created_at: "2026-04-08T13:32:00Z", last_updated_at: null });
    });
    it("should throw a validation error", () => {
        expect(() => defaultThemeService.createTheme("Existing Theme")).toThrow(ConflictError);
    });
});

describe("US-004/CA-09 - When the service is called to find a theme by its id", () => {
    it("should return the searched theme", () => {
        themeRepository.getById = vi.fn().mockReturnValue({ id: "existing-id", name: "Existing Theme", created_at: "2026-04-08T13:32:00Z", last_updated_at: null });
        const existingTheme = defaultThemeService.getById("existing-id");
        expect(existingTheme?.id).toBe("existing-id");
        expect(existingTheme?.name).toBe("Existing Theme");
        expect(existingTheme?.created_at).toBe("2026-04-08T13:32:00Z");
        expect(existingTheme?.last_updated_at).toBeNull();
    });
    it("should return undefined", () => {
        themeRepository.getById = vi.fn().mockReturnValue(undefined);
        const notexistingTheme = defaultThemeService.getById("not-existing-id");
        expect(notexistingTheme).toBeUndefined();
    });
});

describe("US-004/CA-13 - When the service is called to find all themes with pagination", () => {
    beforeEach(() => {
        themeRepository.count = vi.fn().mockReturnValue(10);
    });
    it("should return the first theme", () => {
        themeRepository.getAll = vi.fn().mockReturnValue([{ id: "existing-id", name: "Existing Theme", created_at: "2026-04-16T23:02:00Z", last_updated_at: null }] as Theme[]);
        const themes: Pagination<Theme> = defaultThemeService.getAll(0, 1);
        expect(themes.data?.length).toBe(1);
        expect(themes.limit).toBe(1);
        expect(themes.page).toBe(0);
        expect(themes.total).toBe(10);
        expect(themes.total_pages).toBe(10);
    });
    it("should return the two first themes", () => {
        themeRepository.getAll = vi.fn().mockReturnValue(
            [
                { id: "existing-id", name: "Existing Theme", created_at: "2026-04-16T23:02:00Z", last_updated_at: null },
                { id: "another-id", name: "Another Theme", created_at: "2026-04-16T23:09:00Z", last_updated_at: null }
            ] as Theme[]);
        const themes: Pagination<Theme> = defaultThemeService.getAll(0, 2);
        expect(themes.data?.length).toBe(2);
        expect(themes.limit).toBe(2);
        expect(themes.page).toBe(0);
        expect(themes.total).toBe(10);
        expect(themes.total_pages).toBe(5);
    });
});

describe("US-004/CA-20 - Update a theme name", () => {
    let update_date: string;
    let theme: Theme;
    let updated_name: string;
    beforeEach(() => {
        update_date = "2026-04-17T17:05:00.000Z";
        theme = defaultThemeService.createTheme("Mon thème préféré");
        clock.now = vi.fn().mockReturnValue(new Date(update_date));
        updated_name = "I love it";
    });
    it("should update the date", () => {
        themeRepository.getById = vi.fn().mockReturnValue(theme);
        const updated_theme = defaultThemeService.updateTheme(theme.id, updated_name);
        expect(updated_theme.name).toBe(updated_name);
        expect(updated_theme.last_updated_at).toBe(update_date);
    });
    it("should throw a ThemeNotFoundError", () => {
        themeRepository.getById = vi.fn().mockReturnValue(undefined);
        expect(() => { defaultThemeService.updateTheme(theme.id, updated_name) }).toThrow(ThemeNotFoundError);
    });
});

describe("US-004/CA-21 - Update a formatted theme", () => {
    let theme: Theme;
    beforeEach(() => {
        theme = defaultThemeService.createTheme("Mon thème préféré");
        themeRepository.getById = vi.fn().mockReturnValue(theme);
    });
    it("should update with formatted name", () => {
        const updated_name = "    I   love     it    ";
        const updated_theme = defaultThemeService.updateTheme(theme.id, updated_name);
        expect(updated_theme.name).toBe("I love it");
    });
    it("should throw a validation error", () => {
        const updated_name = "A";
        expect(() => defaultThemeService.updateTheme(theme.id, updated_name)).toThrow(ValidationError);
    });
    it("should throw a conflict error", () => {
        themeRepository.getByName = vi.fn().mockReturnValue({ id: "019d9d6f-eae6-730c-96db-b81da74765e2", name: "An existing theme", created_at: "2026-04-23 10:29:30", last_updated_at: null } as Theme);
        const update_name = "An existing theme";
        expect(() => defaultThemeService.updateTheme(theme.id, update_name)).toThrow(ConflictError);
    });
});

describe("US-004/CA-22 - Update a theme with the same name", () => {
    let theme: Theme;
    let updated_theme: Theme;
    beforeEach(() => {
        theme = defaultThemeService.createTheme("Test Theme");
        themeRepository.getById = vi.fn().mockReturnValue(theme);
    });
    it("should return a 200 and the update date unchanged", () => {
        updated_theme = defaultThemeService.updateTheme(theme.id, theme.name);
    });
    it("should return a 200 and the update date unchanged when formatted names are equal", () => {
        updated_theme = defaultThemeService.updateTheme(theme.id, "  TeST    tHeMe   ");
    });
    afterEach(() => {
        expect(updated_theme.id).toBe(theme.id);
        expect(updated_theme.name).toBe(theme.name);
        expect(updated_theme.created_at).toBe(theme.created_at);
        expect(updated_theme.last_updated_at).toBe(theme.last_updated_at);
        expect(themeRepository.update).not.toHaveBeenCalled();

    });
});

describe("US-004/CA-28 - Delete a theme without associated questions", () => {
    it("should delete the theme with the id", () => {
        let theme = defaultThemeService.createTheme("Test Theme");
        themeRepository.getById = vi.fn().mockReturnValue(theme);
        defaultThemeService.deleteTheme(theme.id);
        expect(themeRepository.delete).toHaveBeenCalled();
    });
});

describe("US-004/CA-29 - Delete a theme with inexisting id", () => {
    it("should return a NotFoundError", () => {
        themeRepository.getById = vi.fn().mockReturnValue(undefined);
        expect(() => defaultThemeService.deleteTheme("019d6cdd-30db-7437-ac57-5826c0695222")).toThrow(ThemeNotFoundError);
    });
});

describe("US-004/CA-30 - Delete a theme used in questions", () => {
    it("should return a ThemeHasQuestionsError", () => {
        themeRepository.getById = vi.fn().mockReturnValue({ id: "019d6cdd-30db-7437-ac57-5826c0695222", name: "Theme Test", created_at: clock.now().toISOString(), last_updated_at: null } as Theme);
        themeRepository.isUsedInQuestions = vi.fn().mockImplementation(() => { return true });
        expect(() => defaultThemeService.deleteTheme("019d6cdd-30db-7437-ac57-5826c0695222")).toThrow(ThemeHasQuestionsError);
    });
});