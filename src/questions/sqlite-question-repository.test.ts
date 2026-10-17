import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Question } from "./question.interface";
import { McqQuestion } from "./mcq-question.interface";
import { Theme } from "../themes/theme.interface";
import { SqliteThemeRepository } from "../themes/sqlite-theme-repository";
import { SqliteQuestionRepository } from "./sqlite-question-repository";
import SqliteDatabase, { Database } from "better-sqlite3";

let repository: SqliteQuestionRepository;
let speedQuestion: Question;
let database: Database;

beforeEach(() => {
    database = new SqliteDatabase(":memory:");
    const parentTheme: Theme = { id: "019d6c17-1c08-7161-9358-fe4a116fa000", name: "Theme parent", created_at: new Date().toISOString(), last_updated_at: null };
    const themeRepository = new SqliteThemeRepository(database);
    themeRepository.insert(parentTheme);
    repository = new SqliteQuestionRepository(database);
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
    database.close();
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

describe("US-005/CA-21 - SqliteQuestionRepository retrieves a question by its id", () => {
    it("should return the inserted SPEED question when searched by its id", () => {
        repository.insert(speedQuestion);
        const found = repository.getById(speedQuestion.id);
        expect(found).toEqual(speedQuestion);
    });
});

describe("US-005/CA-21 - SqliteQuestionRepository retrieves an MCQ question with its choices by its id", () => {
    it("should return the inserted MCQ question with its choices when searched by its id", () => {
        const mcqQuestion: McqQuestion = { ...speedQuestion, type: "MCQ", choices: ['Madrid', 'Paris', 'Lisbonne', 'Berlin'] };
        repository.insert(mcqQuestion);
        const found = repository.getById(mcqQuestion.id);
        expect(found).toEqual(mcqQuestion);
    });
});

describe("US-005/CA-26 - SqliteQuestionRepository lists the stored questions", () => {
    it("should return the inserted question when a single question is stored", () => {
        // Arrange
        repository.insert(speedQuestion);
        // Act
        const questions = repository.getAll(1, 20);
        // Assert
        expect(questions.map(q => q.id)).toEqual([speedQuestion.id]);
    });
});

describe("US-005/CA-27 - SqliteQuestionRepository lists the most recent questions first", () => {
    let olderQuestion: Question;
    let newerQuestion: Question;

    beforeEach(() => {
        olderQuestion = { ...speedQuestion, created_at: "2026-01-01T10:00:00.000Z" };
        newerQuestion = {
            ...speedQuestion,
            id: "019d6c17-1c08-7161-9358-fe4a116fa389",
            title: "Quelle est la capitale du Portugal",
            correct_answer: "Lisbonne",
            created_at: "2026-01-02T10:00:00.000Z"
        };
    });

    it("should return the most recent question first when two questions are stored from the oldest to the newest", () => {
        // Arrange
        repository.insert(olderQuestion);
        repository.insert(newerQuestion);
        // Act
        const questions = repository.getAll(1, 20);
        // Assert
        expect(questions.map(q => q.id)).toEqual([newerQuestion.id, olderQuestion.id]);
    });

    it("should return the most recent question first when two questions are stored from the newest to the oldest", () => {
        // Arrange
        repository.insert(newerQuestion);
        repository.insert(olderQuestion);
        // Act
        const questions = repository.getAll(1, 20);
        // Assert
        expect(questions.map(q => q.id)).toEqual([newerQuestion.id, olderQuestion.id]);
    });
});

describe("US-005/CA-26 - SqliteQuestionRepository limits the number of listed questions", () => {
    let oldestQuestion: Question;
    let middleQuestion: Question;
    let newestQuestion: Question;

    beforeEach(() => {
        oldestQuestion = { ...speedQuestion, created_at: "2026-01-01T10:00:00.000Z" };
        newestQuestion = {
            ...speedQuestion,
            id: "019d6c17-1c08-7161-9358-fe4a116fa389",
            title: "Quelle est la capitale du Portugal",
            correct_answer: "Lisbonne",
            created_at: "2026-01-03T10:00:00.000Z"
        };
        middleQuestion = {
            ...speedQuestion,
            id: "019d6c17-1c08-7161-9358-fe4a116fa38a",
            title: "Quelle est la capitale de l'Espagne",
            correct_answer: "Madrid",
            created_at: "2026-01-02T10:00:00.000Z"
        };
    });

    it("should return only the most recent questions up to the limit when more questions are stored", () => {
        // Arrange
        repository.insert(oldestQuestion);
        repository.insert(newestQuestion);
        repository.insert(middleQuestion);
        // Act
        const questions = repository.getAll(1, 2);
        // Assert
        expect(questions.map(q => q.id)).toEqual([newestQuestion.id, middleQuestion.id]);
    });

    it("should return only the most recent question when the limit is one", () => {
        // Arrange
        repository.insert(oldestQuestion);
        repository.insert(newestQuestion);
        repository.insert(middleQuestion);
        // Act
        const questions = repository.getAll(1, 1);
        // Assert
        expect(questions.map(q => q.id)).toEqual([newestQuestion.id]);
    });
});
