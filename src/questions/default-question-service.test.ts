import { beforeEach, describe, expect, it, vi } from "vitest";
import { Clock } from "../common/clock.interface";
import { UuidGenerator } from "../common/uuid-generator.interface";
import { DefaultQuestionService } from "./default-question-service";
import { QuestionRepository } from "./question-repository.interface";
import { CreateMcqInput } from "./create-mcq-input.interface";
import { CreateSpeedInput } from "./create-speed-input.interface";
import { Question } from "./question.interface";
import { ValidationError } from "./validation-error";
import { ConflictError } from "./conflict-error";
import { InvalidThemeError } from "./invalid-theme-error";
import { ThemeExistenceChecker } from "./theme-existence-checker.interface";

let clock: Clock;
let uuidGenerator: UuidGenerator;
let questionRepository: QuestionRepository;
let defaultQuestionService: DefaultQuestionService;
let themeExistenceChecker: ThemeExistenceChecker;

beforeEach(() => {
    clock = { now: vi.fn().mockReturnValue(new Date("2026-04-08T13:32:00Z")) };
    uuidGenerator = { generate: vi.fn().mockReturnValue("019d6cdd-30db-7437-ac57-5826c0695222") };
    questionRepository = {
        insert: vi.fn(),
        getByTitle: vi.fn()
    };
    themeExistenceChecker = { exists: vi.fn().mockReturnValue(true) };
    defaultQuestionService = new DefaultQuestionService(
        clock, uuidGenerator, questionRepository, themeExistenceChecker
    );
});

describe("US-005/CA-001 - When the service is called to create a valid MCQ question", () => {
    let question: Question;
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
        if (question.type !== "MCQ") throw new Error("expected MCQ");

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

describe("US-005/CA-002 - When the service is called to create a valid SPEED question", () => {
    let question: Question;
    const input: CreateSpeedInput = {
        type: "SPEED",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quel est le plus grand océan du monde ?",
        correct_answer: "Pacifique",
        level: 2,
        time_limit: 15,
        points: 20,
    };
    beforeEach(() => {
        question = defaultQuestionService.createQuestion(input);
    });
    it("should create a SPEED question with the generated id, timestamps and all provided fields", () => {
        if (question.type !== "SPEED") throw new Error("expected SPEED");

        expect(question.id).toBe("019d6cdd-30db-7437-ac57-5826c0695222");
        expect(question.type).toBe("SPEED");
        expect(question.theme_id).toBe("018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a");
        expect(question.title).toBe("Quel est le plus grand océan du monde ?");
        expect(question.correct_answer).toBe("Pacifique");
        expect(question.level).toBe(2);
        expect(question.time_limit).toBe(15);
        expect(question.points).toBe(20);
        expect(question.image_path).toBeNull();
        expect(question.audio_path).toBeNull();
        expect(question.created_at).toBe("2026-04-08T13:32:00.000Z");
        expect(question.last_updated_at).toBeNull();
    });
    it("should not carry a choices field", () => {
        expect("choices" in question).toBe(false);
    });
    it("should insert the created question into the repository", () => {
        expect(questionRepository.insert).toHaveBeenCalledWith(question);
    });
});

describe("US-005/CA-003 - When the service creates a question with internal multiple spaces in the title", () => {
    let question: Question;
    const input: CreateSpeedInput = {
        type: "SPEED",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quelle est   la capitale",
        correct_answer: "Paris",
        level: 1,
        time_limit: 30,
        points: 10,
    };
    beforeEach(() => {
        question = defaultQuestionService.createQuestion(input);
    });
    it("should collapse multiple internal spaces in the title", () => {
        expect(question.title).toBe("Quelle est la capitale");
    });
});

describe("US-005/CA-003 - When the service creates a question with leading and trailing spaces in the title", () => {
    let question: Question;
    const input: CreateSpeedInput = {
        type: "SPEED",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "  Quelle est la capitale  ",
        correct_answer: "Paris",
        level: 1,
        time_limit: 30,
        points: 10,
    };
    beforeEach(() => {
        question = defaultQuestionService.createQuestion(input);
    });
    it("should trim leading and trailing spaces from the title", () => {
        expect(question.title).toBe("Quelle est la capitale");
    });
});

describe("US-005/CA-004 - When the service creates a question with a title shorter than 10 characters", () => {
    const input: CreateSpeedInput = {
        type: "SPEED",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Bonjours!",
        correct_answer: "Paris",
        level: 1,
        time_limit: 30,
        points: 10,
    };
    it("should reject a title shorter than 10 characters with a ValidationError", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow(ValidationError);
    });
});

describe("US-005/CA-004 - When the service creates a question with a title longer than 250 characters", () => {
    const input: CreateSpeedInput = {
        type: "SPEED",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "A" + "a".repeat(250),
        correct_answer: "Paris",
        level: 1,
        time_limit: 30,
        points: 10,
    };
    it("should reject a title longer than 250 characters with a ValidationError", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow(ValidationError);
    });
});

describe("US-005/CA-004 - When the service creates a question whose title does not start with an uppercase letter", () => {
    const input: CreateSpeedInput = {
        type: "SPEED",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "bonjour le monde",
        correct_answer: "Paris",
        level: 1,
        time_limit: 30,
        points: 10,
    };
    it("should reject a title that does not start with an uppercase letter with a ValidationError", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow(ValidationError);
    });
});

describe("US-005/CA-005 - When the service creates a question whose title already exists", () => {
    const input: CreateSpeedInput = {
        type: "SPEED",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quelle est la capitale de la France ?",
        correct_answer: "Paris",
        level: 1,
        time_limit: 30,
        points: 10,
    };
    beforeEach(() => {
        const existing = { id: "018e4f5a-8c3b-7d2e-9f1a-000000000000" } as Question;
        vi.mocked(questionRepository.getByTitle).mockReturnValue(existing);
    });
    it("should reject a title that already exists with a ConflictError", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow(ConflictError);
    });
});

describe("US-005/CA-007 - When the service creates a question whose theme_id does not reference an existing theme", () => {
    const input: CreateSpeedInput = {
        type: "SPEED",
        theme_id: "019d92d2-e1f6-7d05-9803-3948dbc4c416", // bien formé UUIDv7, mais inexistant
        title: "Qui a peint la Joconde ?",
        correct_answer: "Léonard de Vinci",
        level: 3,
        time_limit: 30,
        points: 10,
    };
    beforeEach(() => {
        vi.mocked(themeExistenceChecker.exists).mockReturnValue(false);
    });
    it("should reject a theme_id that references no existing theme with an InvalidThemeError", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow(InvalidThemeError);
    });
});