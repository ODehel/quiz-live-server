import { assert, beforeEach, describe, expect, it, vi } from "vitest";
import { Clock } from "../common/clock.interface";
import { UuidGenerator } from "../common/uuid-generator.interface";
import { DefaultThemeService } from "./default-theme-service";
import { Theme } from "./theme.interface";
import { ThemeRepository } from "./theme-repository.interface";
import { ValidationError } from "./validation-error";
import { ConflictError } from "./conflict-error";

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
        getById: vi.fn(),
        getByName: vi.fn()
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