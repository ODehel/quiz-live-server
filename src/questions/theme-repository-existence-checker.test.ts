import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeRepository } from "../themes/theme-repository.interface";
import { Theme } from "../themes/theme.interface";
import { ThemeRepositoryExistenceChecker } from "./theme-repository-existence-checker";

describe("US-005/CA-7 - Theme existence checked against the theme repository", () => {
    let themeRepository: ThemeRepository;
    let checker: ThemeRepositoryExistenceChecker;

    beforeEach(() => {
        themeRepository = { getById: vi.fn() } as unknown as ThemeRepository;
        checker = new ThemeRepositoryExistenceChecker(themeRepository);
    });

    it("tells that a theme found by the repository exists", () => {
        const knownTheme: Theme = { id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a", name: "Géographie", created_at: "2026-03-09T14:30:00.000Z", last_updated_at: null };
        vi.mocked(themeRepository.getById).mockImplementation(id => id === knownTheme.id ? knownTheme : undefined);

        expect(checker.exists(knownTheme.id)).toBe(true);
    });
    it("tells that a theme unknown to the repository does not exist", () => {
        vi.mocked(themeRepository.getById).mockReturnValue(undefined);

        expect(checker.exists("018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a")).toBe(false);
    });
});
