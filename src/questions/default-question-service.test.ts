import { beforeEach, describe, expect, it, vi } from "vitest";
import { Clock } from "../common/clock.interface";
import { UuidGenerator } from "../common/uuid-generator.interface";
import { DefaultQuestionService } from "./default-question-service";
import { QuestionRepository } from "./question-repository.interface";
import { McqQuestion } from "./question.interface";
import { CreateMcqInput } from "./create-question-input.interface";

let clock: Clock;
let uuidGenerator: UuidGenerator;
let questionRepository: QuestionRepository;
let defaultQuestionService: DefaultQuestionService;

beforeEach(() => {
    clock = { now: vi.fn().mockReturnValue(new Date("2026-04-08T13:32:00Z")) };
    uuidGenerator = { generate: vi.fn().mockReturnValue("019d6cdd-30db-7437-ac57-5826c0695222") };
    questionRepository = {
        insert: vi.fn()
    };
    defaultQuestionService = new DefaultQuestionService(clock, uuidGenerator, questionRepository);
});

describe("US-005/CA-001 - When the service is called to create a valid MCQ question", () => {
    let question: McqQuestion;
    const input: CreateMcqInput = {
        type: "MCQ",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quelle est la capitale de la France ?",
        choices: ["Paris", "Lyon", "Marseille", "Toulouse"],
        correct_answer: "Paris",
        level: 1,
        time_limit: 30,
        points: 10,
    };
    beforeEach(() => {
        question = defaultQuestionService.createQuestion(input);
    });
    it("should create a MCQ question with the generated id, timestamps and all provided fields", () => {
        expect(question.id).toBe("019d6cdd-30db-7437-ac57-5826c0695222");
        expect(question.type).toBe("MCQ");
        expect(question.theme_id).toBe("018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a");
        expect(question.title).toBe("Quelle est la capitale de la France ?");
        expect(question.choices).toEqual(["Paris", "Lyon", "Marseille", "Toulouse"]);
        expect(question.correct_answer).toBe("Paris");
        expect(question.level).toBe(1);
        expect(question.time_limit).toBe(30);
        expect(question.points).toBe(10);
        expect(question.image_path).toBeNull();
        expect(question.audio_path).toBeNull();
        expect(question.created_at).toBe("2026-04-08T13:32:00.000Z");
        expect(question.last_updated_at).toBeNull();
    });
    it("should insert the created question into the repository", () => {
        expect(questionRepository.insert).toHaveBeenCalledWith(question);
    });
});