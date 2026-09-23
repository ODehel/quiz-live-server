import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unlinkSync } from "node:fs";
import { Question } from "./question.interface";
import { McqQuestion } from "./mcq-question.interface";
import { Theme } from "../themes/theme.interface";
import { SqliteThemeRepository } from "../themes/sqlite-theme-repository";
import { SqliteQuestionRepository } from "./sqlite-question-repository";

let repository: SqliteQuestionRepository;
let databaseFilePath: string;
let speedQuestion: Question;

beforeEach(() => {
    databaseFilePath = join(tmpdir(), `quiz-question-repo-${randomUUID()}.db`);
    const parentTheme: Theme = { id: "019d6c17-1c08-7161-9358-fe4a116fa000", name: "Theme parent", created_at: new Date().toISOString(), last_updated_at: null };
    const themeRepository = new SqliteThemeRepository(databaseFilePath);
    themeRepository.insert(parentTheme);
    themeRepository.close();
    repository = new SqliteQuestionRepository(databaseFilePath);
    speedQuestion = {
        id: "019d6c17-1c08-7161-9358-fe4a116fa388",
        type: "SPEED",
        theme_id: "019d6c17-1c08-7161-9358-fe4a116fa000",
        title: "Quelle est la capitale de la France",
        correct_answer: "Paris",
        level: 3,
        time_limit: 30,
        points: 10,
        image_path: null,
        audio_path: null,
        created_at: new Date().toISOString(),
        last_updated_at: null
    };
});
afterEach(() => {
    repository.close();
    unlinkSync(databaseFilePath);
});

describe("US-005 - SqliteQuestionRepository persists and retrieves a SPEED question by title", () => {
    it("should return the inserted SPEED question when searched by its title", () => {
        // Arrange
        repository.insert(speedQuestion);
        // Act
        const found = repository.getByTitle(speedQuestion.title);
        // Assert
        expect(found).not.toBeUndefined();
        expect(found?.id).toBe(speedQuestion.id);
        expect(found?.type).toBe("SPEED");
        expect(found?.theme_id).toBe(speedQuestion.theme_id);
        expect(found?.title).toBe(speedQuestion.title);
        expect(found?.correct_answer).toBe(speedQuestion.correct_answer);
        expect(found?.level).toBe(speedQuestion.level);
        expect(found?.time_limit).toBe(speedQuestion.time_limit);
        expect(found?.points).toBe(speedQuestion.points);
        expect(found?.image_path).toBe(speedQuestion.image_path);
        expect(found?.audio_path).toBe(speedQuestion.audio_path);
        expect(found?.created_at).toBe(speedQuestion.created_at);
        expect(found?.last_updated_at).toBe(speedQuestion.last_updated_at);
    });
});

describe("US-005 - SqliteQuestionRepository persists and retrieves the choices of an MCQ question", () => {
    it("should return the inserted MCQ question with its choices when searched by its title", () => {
        const mcqQuestion: McqQuestion = {
            id: "019d6c17-1c08-7161-9358-fe4a116fa388",
            type: "MCQ",
            theme_id: "019d6c17-1c08-7161-9358-fe4a116fa000",
            title: "Quelle est la capitale de la France",
            choices: ['Madrid', 'Paris', 'Lisbonne', 'Berlin'],
            correct_answer: "Paris",
            level: 3,
            time_limit: 30,
            points: 10,
            image_path: null,
            audio_path: null,
            created_at: new Date().toISOString(),
            last_updated_at: null
        };
        repository.insert(mcqQuestion);
        const found = repository.getByTitle(mcqQuestion.title);
        expect(found?.type).toBe("MCQ");
        expect((found as McqQuestion).choices).toEqual(mcqQuestion.choices);
    });
});
