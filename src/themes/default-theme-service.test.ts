import { assert, beforeEach, describe, it, vi } from "vitest";
import { Clock } from "../common/clock.interface";
import { UuidGenerator } from "../common/uuid-generator.interface";
import { DefaultThemeService } from "./default-theme-service";
import { Theme } from "./theme.interface";

let clock: Clock;
let uuidGenerator: UuidGenerator;
let defaultThemeService: DefaultThemeService;

beforeEach(() => {
    clock = { now: vi.fn().mockReturnValue(new Date("2026-04-08T13:32:00Z")) };
    uuidGenerator = { generate: vi.fn().mockReturnValue("019d6cdd-30db-7437-ac57-5826c0695222") };
    defaultThemeService = new DefaultThemeService(clock, uuidGenerator);
});

describe("US-004/CA-001 - When the service is called to create a theme", () => {
    it("should create a theme with the provided name and the current date as creation date", () => {
        const theme: Theme = defaultThemeService.createTheme("Test Theme");
        assert.equal(theme.id, uuidGenerator.generate());
        assert.equal(theme.name, "Test Theme");
        assert.equal(theme.created_at, clock.now().toISOString());
        assert.isNull(theme.last_updated_at);
    });
});