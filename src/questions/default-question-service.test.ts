import { beforeEach, describe, expect, it, vi } from "vitest";
import { Clock } from "../common/clock.interface";
import { UuidGenerator } from "../common/uuid-generator.interface";
import { CreateQuestionInput, DefaultQuestionService } from "./default-question-service";
import { QuestionRepository } from "./question-repository.interface";
import { CreateMcqInput } from "./create-mcq-input.interface";
import { CreateSpeedInput } from "./create-speed-input.interface";
import { Question } from "./question.interface";
import { ValidationError } from "./validation-error";
import { ConflictError } from "./conflict-error";
import { InvalidThemeError } from "./invalid-theme-error";
import { InvalidUuidError } from "./invalid-uuid-error";
import { UuidValidator } from "../common/uuid-validator.interface";
import { TypeChangeNotAllowedError } from "./type-change-not-allowed-error";
import { UnknownFieldsError } from "./unknown-fields-error";
import { ThemeExistenceChecker } from "./theme-existence-checker.interface";
import { NotFoundError } from "../common/not-found-error";
import { Pagination } from "../common/pagination.interface";

let clock: Clock;
let uuidGenerator: UuidGenerator;
let questionRepository: QuestionRepository;
let defaultQuestionService: DefaultQuestionService;
let themeExistenceChecker: ThemeExistenceChecker;
let uuidValidator: UuidValidator;

beforeEach(() => {
    clock = { now: vi.fn().mockReturnValue(new Date("2026-04-08T13:32:00Z")) };
    uuidGenerator = { generate: vi.fn().mockReturnValue("019d6cdd-30db-7437-ac57-5826c0695222") };
    questionRepository = {
        insert: vi.fn(),
        getByTitle: vi.fn(),
        getById: vi.fn(),
        getAll: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
        delete: vi.fn()
    };
    themeExistenceChecker = { exists: vi.fn().mockReturnValue(true) };
    uuidValidator = { validate: vi.fn().mockReturnValue(true) };
    defaultQuestionService = new DefaultQuestionService(
        clock, uuidGenerator, questionRepository, themeExistenceChecker, uuidValidator
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
    it("should explain that the title must be at least 10 characters long", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow("Question title must be at least 10 characters long.");
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
    it("should explain that the title must be at most 250 characters long", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow("Question title must be at most 250 characters long.");
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
    it("should explain that the title must start with an uppercase letter", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow("Question title must start with an uppercase letter.");
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

describe("US-005/CA-006 - When the service creates a question with a type other than MCQ or SPEED", () => {
    const input = {
        type: "OPEN",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Qui a peint la Joconde ?",
        correct_answer: "Léonard de Vinci",
        level: 3,
        time_limit: 30,
        points: 10,
    } as unknown as CreateQuestionInput;

    it("should reject the question with a ValidationError", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow(ValidationError);
    });

    it("should explain that the type must be MCQ or SPEED", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow("Question type must be MCQ or SPEED.");
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

describe("US-005/CA-009 - When the service creates a MCQ question whose choices count is not exactly 4", () => {
    const input: CreateMcqInput = {
        type: "MCQ",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quelle est la capitale de la France ?",
        choices: ["Paris", "Lyon", "Marseille"],
        correct_answer: "Paris",
        level: 1,
        time_limit: 30,
        points: 10,
    };
    it("should reject a MCQ with a choices count other than 4 with a ValidationError", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow(ValidationError);
    });
    it("should explain that the choices must contain exactly 4 entries", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow("Question choices must contain exactly 4 entries.");
    });
});

describe("US-005/CA-009 - When the service creates a MCQ question with an empty choice", () => {
    const input: CreateMcqInput = {
        type: "MCQ",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quelle est la capitale de la France ?",
        choices: ["Paris", "", "Marseille", "Toulouse"],
        correct_answer: "Paris",
        level: 1,
        time_limit: 30,
        points: 10,
    };
    it("should reject a MCQ with an empty choice with a ValidationError", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow(ValidationError);
    });
    it("should explain that each choice must be between 1 and 40 characters", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow("Question choices must each be between 1 and 40 characters.");
    });
});

describe("US-005/CA-009 - When the service creates a MCQ question with a blank choice", () => {
    const input: CreateMcqInput = {
        type: "MCQ",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quelle est la capitale de la France ?",
        choices: ["Paris", " ", "Marseille", "Toulouse"],
        correct_answer: "Paris",
        level: 1,
        time_limit: 30,
        points: 10,
    };
    it("should reject a MCQ with a blank choice with a ValidationError", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow(ValidationError);
    });
});

describe("US-005/CA-009 - When the service creates a MCQ question with surrounding spaces in a choice", () => {
    let question: Question;
    const input: CreateMcqInput = {
        type: "MCQ",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quelle est la capitale de la France ?",
        choices: ["Paris ", "Lyon", "Marseille", "Toulouse"],
        correct_answer: "Paris",
        level: 1,
        time_limit: 30,
        points: 10,
    };
    beforeEach(() => {
        question = defaultQuestionService.createQuestion(input);
    });
    it("should trim surrounding spaces from each choice", () => {
        if (question.type !== "MCQ") throw new Error("expected MCQ");
        expect(question.choices).toEqual(["Paris", "Lyon", "Marseille", "Toulouse"]);
    });
});

describe("US-005/CA-009 - When the service creates a MCQ question with a choice longer than 40 characters", () => {
    const input: CreateMcqInput = {
        type: "MCQ",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quelle est la capitale de la France ?",
        choices: ["Paris", "Lyon", "Marseille", "A".repeat(41)],
        correct_answer: "Paris",
        level: 1,
        time_limit: 30,
        points: 10,
    };
    it("should reject a MCQ with a choice longer than 40 characters with a ValidationError", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow(ValidationError);
    });
});

describe("US-005/CA-009 - When the service creates a MCQ question with two choices that differ only by case", () => {
    const input: CreateMcqInput = {
        type: "MCQ",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quelle est la capitale de la France ?",
        choices: ["Paris", "paris", "Lyon", "Marseille"], // 2 doublons à la casse près
        correct_answer: "Paris",
        level: 1, time_limit: 30, points: 10,
    };
    it("should reject a MCQ with case-insensitive duplicate choices with a ValidationError", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow(ValidationError);
    });
    it("should explain that the choices must be distinct regardless of case", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow("Question choices must be distinct (case-insensitive).");
    });
});

describe("US-005/CA-009 - When the service creates a MCQ question with two choices that are duplicates after trimming", () => {
    const input: CreateMcqInput = {
        type: "MCQ",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quelle est la capitale de la France ?",
        choices: ["Paris ", "paris", "Lyon", "Marseille"],
        correct_answer: "Paris",
        level: 1,
        time_limit: 30,
        points: 10,
    };
    it("should reject choices that collide only after trimming with a ValidationError", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow(ValidationError);
    });
});

describe("US-005/CA-010 - When the service creates a MCQ question whose correct_answer matches none of the choices", () => {
    const input: CreateMcqInput = {
        type: "MCQ",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quelle est la capitale de la France ?",
        choices: ["Paris", "Lyon", "Marseille", "Toulouse"],
        correct_answer: "Berlin",
        level: 1,
        time_limit: 30,
        points: 10,
    };
    it("should reject a correct_answer absent from the choices with a ValidationError", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow(ValidationError);
    });
    it("should explain that the correct_answer must be one of the choices", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow("Question correct_answer must match one of the choices (case-insensitive).");
    });
});

describe("US-005/CA-010 - When the service creates a MCQ question whose correct_answer matches a choice only by case", () => {
    let question: Question;
    const input: CreateMcqInput = {
        type: "MCQ",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quelle est la capitale de la France ?",
        choices: ["Paris", "Lyon", "Marseille", "Toulouse"],
        correct_answer: "paris",
        level: 1,
        time_limit: 30,
        points: 10,
    };
    beforeEach(() => {
        question = defaultQuestionService.createQuestion(input);
    });
    it("should accept a correct_answer that matches a choice case-insensitively", () => {
        if (question.type !== "MCQ") throw new Error("expected MCQ");
        expect(question.correct_answer).toBe("paris");
    });
});

describe("US-005/CA-010 - When the service creates a MCQ question whose correct_answer matches a choice apart from surrounding whitespace", () => {
    const input: CreateMcqInput = {
        type: "MCQ",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quelle est la capitale de la France ?",
        choices: ["Paris", "Lyon", "Marseille", "Toulouse"],
        correct_answer: "  Paris  ",
        level: 1,
        time_limit: 30,
        points: 10,
    };
    it("should accept a correct_answer that matches a choice once surrounding whitespace is trimmed", () => {
        expect(() => defaultQuestionService.createQuestion(input)).not.toThrow();
    });
});

describe("US-005/CA-010 - When the service creates a MCQ question whose correct_answer is only whitespace", () => {
    const input: CreateMcqInput = {
        type: "MCQ",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quelle est la capitale de la France ?",
        choices: ["Paris", "Lyon", "Marseille", "Toulouse"],
        correct_answer: "   ",
        level: 1,
        time_limit: 30,
        points: 10,
    };
    it("should explain that the correct_answer must be one of the choices, not its length", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow("Question correct_answer must match one of the choices (case-insensitive).");
    });
});

describe("US-005/CA-012 - When the service creates a SPEED question with an empty correct_answer", () => {
    const input: CreateSpeedInput = {
        type: "SPEED",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quel est le plus grand océan du monde ?",
        correct_answer: "",
        level: 2,
        time_limit: 15,
        points: 20,
    };
    it("should reject a SPEED with an empty correct_answer with a ValidationError", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow(ValidationError);
    });
});

describe("US-005/CA-012 - When the service creates a SPEED question with a correct_answer longer than 40 characters", () => {
    const input: CreateSpeedInput = {
        type: "SPEED",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quel est le plus grand océan du monde ?",
        correct_answer: "A".repeat(41),
        level: 2,
        time_limit: 15,
        points: 20,
    };
    it("should reject a SPEED with a correct_answer longer than 40 characters with a ValidationError", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow(ValidationError);
    });
});

describe("US-005/CA-012 - When the service creates a SPEED question whose correct_answer is only whitespace", () => {
    const input: CreateSpeedInput = {
        type: "SPEED",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quel est le plus grand océan du monde ?",
        correct_answer: "   ",
        level: 2,
        time_limit: 15,
        points: 20,
    };
    it("should reject a SPEED whose correct_answer is only whitespace with a ValidationError", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow(ValidationError);
    });
    it("should explain the correct_answer length rule", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow("Question correct_answer must be between 1 and 40 characters.");
    });
});

describe("US-005/CA-012 - When the service creates a SPEED question whose correct_answer has surrounding whitespace", () => {
    let question: Question;
    const input: CreateSpeedInput = {
        type: "SPEED",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quel est le plus grand océan du monde ?",
        correct_answer: "  Pacifique  ",
        level: 2,
        time_limit: 15,
        points: 20,
    };
    beforeEach(() => {
        question = defaultQuestionService.createQuestion(input);
    });
    it("should persist the correct_answer trimmed of its surrounding whitespace", () => {
        expect(question.correct_answer).toBe("Pacifique");
    });
});

describe("US-005/CA-013 - When the service creates a question whose level is greater than 5", () => {
    const input: CreateSpeedInput = {
        type: "SPEED",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quel est le plus grand océan du monde ?",
        correct_answer: "Pacifique",
        level: 6,
        time_limit: 15,
        points: 20,
    };
    it("should reject a level greater than 5 with a ValidationError", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow(ValidationError);
    });
    it("should explain that the level must be an integer between 1 and 5", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow("Question level must be an integer between 1 and 5.");
    });
});

describe("US-005/CA-013 - When the service creates a question whose level is less than 1", () => {
    const input: CreateSpeedInput = {
        type: "SPEED",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quel est le plus grand océan du monde ?",
        correct_answer: "Pacifique",
        level: 0,
        time_limit: 15,
        points: 20,
    };
    it("should reject a level less than 1 with a ValidationError", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow(ValidationError);
    });
});

describe("US-005/CA-013 - When the service creates a question whose level is not an integer", () => {
    const input: CreateSpeedInput = {
        type: "SPEED",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quel est le plus grand océan du monde ?",
        correct_answer: "Pacifique",
        level: 2.5,
        time_limit: 15,
        points: 20,
    };
    it("should reject a non-integer level with a ValidationError", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow(ValidationError);
    });
});

describe("US-005/CA-014 - When the service creates a question whose time_limit is greater than 60", () => {
    const input: CreateSpeedInput = {
        type: "SPEED",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quel est le plus grand océan du monde ?",
        correct_answer: "Pacifique",
        level: 3,
        time_limit: 61,
        points: 20,
    };
    it("should reject a time_limit greater than 60 with a ValidationError", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow(ValidationError);
    });
    it("should explain that the time_limit must be an integer between 5 and 60 seconds", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow("Question time_limit must be an integer between 5 and 60 seconds.");
    });
});

describe("US-005/CA-014 - When the service creates a question whose time_limit is less than 5", () => {
    const input: CreateSpeedInput = {
        type: "SPEED",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quel est le plus grand océan du monde ?",
        correct_answer: "Pacifique",
        level: 3,
        time_limit: 4,
        points: 20,
    };
    it("should reject a time_limit less than 5 with a ValidationError", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow(ValidationError);
    });
});

describe("US-005/CA-014 - When the service creates a question whose time_limit is not an integer", () => {
    const input: CreateSpeedInput = {
        type: "SPEED",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quel est le plus grand océan du monde ?",
        correct_answer: "Pacifique",
        level: 3,
        time_limit: 12.5,
        points: 20,
    };
    it("should reject a non-integer time_limit with a ValidationError", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow(ValidationError);
    });
});

describe("US-005/CA-015 - When the service creates a question whose points is greater than 50", () => {
    const input: CreateSpeedInput = {
        type: "SPEED",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quel est le plus grand océan du monde ?",
        correct_answer: "Pacifique",
        level: 3,
        time_limit: 30,
        points: 51,
    };
    it("should reject points greater than 50 with a ValidationError", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow(ValidationError);
    });
    it("should explain that the points must be an integer between 1 and 50", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow("Question points must be an integer between 1 and 50.");
    });
});

describe("US-005/CA-015 - When the service creates a question whose points is less than 1", () => {
    const input: CreateSpeedInput = {
        type: "SPEED",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quel est le plus grand océan du monde ?",
        correct_answer: "Pacifique",
        level: 3,
        time_limit: 30,
        points: 0,
    };
    it("should reject points less than 1 with a ValidationError", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow(ValidationError);
    });
});

describe("US-005/CA-015 - When the service creates a question whose points is not an integer", () => {
    const input: CreateSpeedInput = {
        type: "SPEED",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quel est le plus grand océan du monde ?",
        correct_answer: "Pacifique",
        level: 3,
        time_limit: 30,
        points: 12.5,
    };
    it("should reject a non-integer points with a ValidationError", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow(ValidationError);
    });
});

describe("US-005/CA-21 - When the service is asked for a question by its id", () => {
    it("should return the question found by the repository", () => {
        const id = "019d6cdd-30db-7437-ac57-5826c0695222";
        const storedQuestion = { id: id, type: "SPEED" } as Question;
        questionRepository.getById = vi.fn().mockReturnValue(storedQuestion);

        const found = defaultQuestionService.getQuestionById(id);

        expect(questionRepository.getById).toHaveBeenCalledWith(id);
        expect(found).toBe(storedQuestion);
    });
});

describe("US-005/CA-23 - When the service is asked for a question by an unknown id", () => {
    it("should reject with a NotFoundError", () => {
        const id = "018e4f5a-0000-0000-0000-000000000000";
        questionRepository.getById = vi.fn().mockReturnValue(undefined);

        expect(() => defaultQuestionService.getQuestionById(id)).toThrow(NotFoundError);
    });
});

describe("US-005/CA-44 - When the service is asked to delete an existing question", () => {
    it("should ask the repository to delete it", () => {
        const id = "019d6cdd-30db-7437-ac57-5826c0695222";
        questionRepository.getById = vi.fn().mockReturnValue({ id: id, type: "SPEED" });

        defaultQuestionService.deleteQuestion(id);

        expect(questionRepository.delete).toHaveBeenCalledWith(id);
    });
});

describe("US-005/CA-45 - When the service is asked to delete a question by an unknown id", () => {
    const id = "018e4f5a-0000-0000-0000-000000000000";

    beforeEach(() => {
        questionRepository.getById = vi.fn().mockReturnValue(undefined);
    });

    it("should reject with a NotFoundError", () => {
        expect(() => defaultQuestionService.deleteQuestion(id)).toThrow(NotFoundError);
    });

    it("should not ask the repository to delete anything", () => {
        expect(() => defaultQuestionService.deleteQuestion(id)).toThrow();

        expect(questionRepository.delete).not.toHaveBeenCalled();
    });
});

describe("US-005/CA-011 - When the service creates a SPEED question with choices", () => {
    const input = {
        type: "SPEED",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Dans quel pays se trouve la Tour Eiffel ?",
        choices: ["France", "Italie", "Espagne", "Portugal"],
        correct_answer: "France",
        level: 1,
        time_limit: 30,
        points: 10,
    } as unknown as CreateQuestionInput;
    it("should reject a SPEED with choices with a ValidationError", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow(ValidationError);
    });
    it("should explain that choices must be absent for a SPEED question", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow("Question choices must be absent for a SPEED question.");
    });
});

describe("US-005/CA-011 - When the service creates a SPEED question with null choices", () => {
    const input = {
        type: "SPEED",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Dans quel pays se trouve la Tour Eiffel ?",
        choices: null,
        correct_answer: "France",
        level: 1,
        time_limit: 30,
        points: 10,
    } as unknown as CreateQuestionInput;
    it("should reject null choices as present, with the same explanation", () => {
        expect(() => defaultQuestionService.createQuestion(input)).toThrow("Question choices must be absent for a SPEED question.");
    });
});

describe("US-005/CA-26 - When the service lists a page of questions", () => {
    let result: Pagination<Question>;
    const storedQuestion: Question = {
        id: "019d6cdd-30db-7437-ac57-5826c0695223",
        type: "SPEED",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Dans quel pays se trouve la Tour Eiffel ?",
        correct_answer: "France",
        level: 1,
        time_limit: 30,
        points: 10,
        image_path: null,
        audio_path: null,
        created_at: "2026-04-08T13:32:00.000Z",
        last_updated_at: null,
    };
    beforeEach(() => {
        vi.mocked(questionRepository.getAll).mockReturnValue([storedQuestion]);
        vi.mocked(questionRepository.count).mockReturnValue(12);
        result = defaultQuestionService.getAll(2, 5);
    });
    it("should return the questions of the repository page with the page, the limit, the total and the total of pages", () => {
        expect(questionRepository.getAll).toHaveBeenCalledWith(2, 5);
        expect(result).toEqual({ data: [storedQuestion], page: 2, limit: 5, total: 12, total_pages: 3 });
    });
});

describe("US-005/CA-26 - When the service lists the first page and the total is an exact multiple of the limit", () => {
    let result: Pagination<Question>;
    const firstQuestion: Question = {
        id: "019d6cdd-30db-7437-ac57-5826c0695224",
        type: "SPEED",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quelle est la capitale de l'Italie ?",
        correct_answer: "Rome",
        level: 2,
        time_limit: 20,
        points: 5,
        image_path: null,
        audio_path: null,
        created_at: "2026-04-09T08:00:00.000Z",
        last_updated_at: null,
    };
    beforeEach(() => {
        vi.mocked(questionRepository.getAll).mockReturnValue([firstQuestion]);
        vi.mocked(questionRepository.count).mockReturnValue(20);
        result = defaultQuestionService.getAll(1, 10);
    });
    it("should return exactly the pages needed to hold the total, without an extra empty page", () => {
        expect(questionRepository.getAll).toHaveBeenCalledWith(1, 10);
        expect(result).toEqual({ data: [firstQuestion], page: 1, limit: 10, total: 20, total_pages: 2 });
    });
});

describe("US-005/CA-31 - When the service lists a page beyond the total", () => {
    let result: Pagination<Question>;
    beforeEach(() => {
        vi.mocked(questionRepository.getAll).mockReturnValue([]);
        vi.mocked(questionRepository.count).mockReturnValue(12);
        result = defaultQuestionService.getAll(9999, 5);
    });
    it("should return an empty page that keeps the requested page and the real total and total of pages", () => {
        expect(questionRepository.getAll).toHaveBeenCalledWith(9999, 5);
        expect(result).toEqual({ data: [], page: 9999, limit: 5, total: 12, total_pages: 3 });
    });
});

describe("US-005/CA-32 - When the service lists the questions and none is stored", () => {
    let result: Pagination<Question>;
    beforeEach(() => {
        vi.mocked(questionRepository.getAll).mockReturnValue([]);
        vi.mocked(questionRepository.count).mockReturnValue(0);
        result = defaultQuestionService.getAll(1, 20);
    });
    it("should return an empty page with a total of 0 and no page at all", () => {
        expect(result).toEqual({ data: [], page: 1, limit: 20, total: 0, total_pages: 0 });
    });
});

describe("US-005/CA-33 - When the service updates an MCQ question with valid fields", () => {
    let result: Question;
    const storedQuestion: Question = {
        id: "019d6cdd-30db-7437-ac57-5826c0695225",
        type: "MCQ",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quelle est la capitale de la France ?",
        choices: ["Paris", "Lyon", "Marseille", "Toulouse"],
        correct_answer: "Paris",
        level: 1,
        time_limit: 30,
        points: 10,
        image_path: "images/france.png",
        audio_path: "audio/france.mp3",
        created_at: "2026-04-01T09:00:00.000Z",
        last_updated_at: null,
    };
    const input: CreateMcqInput = {
        type: "MCQ",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9b",
        title: "Quelle est la capitale de l'Espagne ?",
        choices: ["Madrid", "Rome", "Vienne", "Oslo"],
        correct_answer: "Madrid",
        level: 4,
        time_limit: 45,
        points: 20,
    };
    const expected: Question = {
        ...storedQuestion,
        theme_id: input.theme_id,
        title: input.title,
        choices: input.choices,
        correct_answer: input.correct_answer,
        level: input.level,
        time_limit: input.time_limit,
        points: input.points,
        last_updated_at: "2026-04-08T13:32:00.000Z",
    };
    beforeEach(() => {
        vi.mocked(questionRepository.getById).mockReturnValue(storedQuestion);
        result = defaultQuestionService.updateQuestion(storedQuestion.id, input);
    });
    it("should return and persist the question with the new fields, the same id, created_at and media paths, and last_updated_at set to now", () => {
        expect(result).toEqual(expected);
        expect(questionRepository.update).toHaveBeenCalledWith(expected);
    });
});

describe("US-005/CA-34 - When the service updates a SPEED question with valid fields", () => {
    let result: Question;
    const storedQuestion: Question = {
        id: "019d6cdd-30db-7437-ac57-5826c0695230",
        type: "SPEED",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quel est le plus grand océan du monde ?",
        correct_answer: "Pacifique",
        level: 2,
        time_limit: 20,
        points: 15,
        image_path: "images/ocean.png",
        audio_path: "audio/ocean.mp3",
        created_at: "2026-04-01T09:00:00.000Z",
        last_updated_at: null,
    };
    const input: CreateSpeedInput = {
        type: "SPEED",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9b",
        title: "Quel est le plus long fleuve du monde ?",
        correct_answer: "Nil",
        level: 3,
        time_limit: 25,
        points: 25,
    };
    const expected: Question = {
        ...storedQuestion,
        theme_id: input.theme_id,
        title: input.title,
        correct_answer: input.correct_answer,
        level: input.level,
        time_limit: input.time_limit,
        points: input.points,
        last_updated_at: "2026-04-08T13:32:00.000Z",
    };
    beforeEach(() => {
        vi.mocked(questionRepository.getById).mockReturnValue(storedQuestion);
        result = defaultQuestionService.updateQuestion(storedQuestion.id, input);
    });
    it("should return and persist a SPEED question with the new fields, the same id, created_at and media paths, and last_updated_at set to now", () => {
        expect(result).toEqual(expected);
        expect(questionRepository.update).toHaveBeenCalledWith(expected);
    });
});

describe("US-005/CA-34 - When the service updates a SPEED question with a body containing choices", () => {
    const storedQuestion: Question = {
        id: "019d6cdd-30db-7437-ac57-5826c0695231",
        type: "SPEED",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quel est le plus grand océan du monde ?",
        correct_answer: "Pacifique",
        level: 2,
        time_limit: 20,
        points: 15,
        image_path: null,
        audio_path: null,
        created_at: "2026-04-01T09:00:00.000Z",
        last_updated_at: null,
    };
    const input = {
        type: "SPEED",
        theme_id: storedQuestion.theme_id,
        title: storedQuestion.title,
        choices: ["Pacifique", "Atlantique", "Indien", "Arctique"],
        correct_answer: "Pacifique",
        level: 2,
        time_limit: 20,
        points: 15,
    } as unknown as CreateSpeedInput;

    beforeEach(() => {
        vi.mocked(questionRepository.getById).mockReturnValue(storedQuestion);
    });

    it("should reject with a ValidationError and not ask the repository to update anything", () => {
        expect(() => defaultQuestionService.updateQuestion(storedQuestion.id, input)).toThrow(ValidationError);
        expect(questionRepository.update).not.toHaveBeenCalled();
    });
});

describe("US-005/CA-37 - When the service updates a SPEED question with exactly the stored data", () => {
    let result: Question;
    const storedQuestion: Question = {
        id: "019d6cdd-30db-7437-ac57-5826c0695240",
        type: "SPEED",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quel est le plus grand océan du monde ?",
        correct_answer: "Pacifique",
        level: 2,
        time_limit: 20,
        points: 15,
        image_path: "images/ocean.png",
        audio_path: "audio/ocean.mp3",
        created_at: "2026-04-01T09:00:00.000Z",
        last_updated_at: "2026-04-05T08:00:00.000Z",
    };
    const input: CreateSpeedInput = {
        type: "SPEED",
        theme_id: storedQuestion.theme_id,
        title: storedQuestion.title,
        correct_answer: storedQuestion.correct_answer,
        level: 2,
        time_limit: 20,
        points: 15,
    };

    beforeEach(() => {
        vi.mocked(questionRepository.getById).mockReturnValue(storedQuestion);
        result = defaultQuestionService.updateQuestion(storedQuestion.id, input);
    });

    it("should return the stored question as it is, with last_updated_at unchanged, and not ask the repository to update anything", () => {
        expect(result).toEqual(storedQuestion);
        expect(questionRepository.update).not.toHaveBeenCalled();
    });
});

describe("US-005/CA-37 - When the service updates an MCQ question whose only change is one of its choices", () => {
    let result: Question;
    const storedQuestion: Question = {
        id: "019d6cdd-30db-7437-ac57-5826c0695241",
        type: "MCQ",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quelle est la capitale de la France ?",
        choices: ["Paris", "Lyon", "Marseille", "Toulouse"],
        correct_answer: "Paris",
        level: 1,
        time_limit: 30,
        points: 10,
        image_path: null,
        audio_path: null,
        created_at: "2026-04-01T09:00:00.000Z",
        last_updated_at: "2026-04-05T08:00:00.000Z",
    };
    const input: CreateMcqInput = {
        type: "MCQ",
        theme_id: storedQuestion.theme_id,
        title: storedQuestion.title,
        choices: ["Paris", "Lyon", "Marseille", "Nice"],
        correct_answer: "Paris",
        level: 1,
        time_limit: 30,
        points: 10,
    };
    const expected: Question = { ...storedQuestion, choices: input.choices, last_updated_at: "2026-04-08T13:32:00.000Z" };

    beforeEach(() => {
        vi.mocked(questionRepository.getById).mockReturnValue(storedQuestion);
        result = defaultQuestionService.updateQuestion(storedQuestion.id, input);
    });

    it("should return and persist the question with the new choices and last_updated_at set to now", () => {
        expect(result).toEqual(expected);
        expect(questionRepository.update).toHaveBeenCalledWith(expected);
    });
});

describe("US-005/CA-37 - When the service updates an MCQ question with exactly the stored data", () => {
    let result: Question;
    const storedQuestion: Question = {
        id: "019d6cdd-30db-7437-ac57-5826c0695242",
        type: "MCQ",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quelle est la capitale de la France ?",
        choices: ["Paris", "Lyon", "Marseille", "Toulouse"],
        correct_answer: "Paris",
        level: 1,
        time_limit: 30,
        points: 10,
        image_path: "images/france.png",
        audio_path: null,
        created_at: "2026-04-01T09:00:00.000Z",
        last_updated_at: "2026-04-05T08:00:00.000Z",
    };
    const input: CreateMcqInput = {
        type: "MCQ",
        theme_id: storedQuestion.theme_id,
        title: storedQuestion.title,
        choices: ["Paris", "Lyon", "Marseille", "Toulouse"],
        correct_answer: "Paris",
        level: 1,
        time_limit: 30,
        points: 10,
    };

    beforeEach(() => {
        vi.mocked(questionRepository.getById).mockReturnValue(storedQuestion);
        result = defaultQuestionService.updateQuestion(storedQuestion.id, input);
    });

    it("should return the stored question as it is, with last_updated_at unchanged, and not ask the repository to update anything", () => {
        expect(result).toEqual(storedQuestion);
        expect(questionRepository.update).not.toHaveBeenCalled();
    });
});

describe("US-005/CA-37 - When the service updates an MCQ question whose only difference is extra spaces", () => {
    const storedQuestion: Question = {
        id: "019d6cdd-30db-7437-ac57-5826c0695244",
        type: "MCQ",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quelle est la capitale de la France ?",
        choices: ["Paris", "Lyon", "Marseille", "Toulouse"],
        correct_answer: "Paris",
        level: 1,
        time_limit: 30,
        points: 10,
        image_path: "images/france.png",
        audio_path: null,
        created_at: "2026-04-01T09:00:00.000Z",
        last_updated_at: "2026-04-05T08:00:00.000Z",
    };
    const identicalInput: CreateMcqInput = {
        type: "MCQ",
        theme_id: storedQuestion.theme_id,
        title: "Quelle est la capitale de la France ?",
        choices: ["Paris", "Lyon", "Marseille", "Toulouse"],
        correct_answer: "Paris",
        level: 1,
        time_limit: 30,
        points: 10,
    };

    beforeEach(() => {
        vi.mocked(questionRepository.getById).mockReturnValue(storedQuestion);
    });

    it.each<[string, Partial<CreateMcqInput>]>([
        ["title", { title: "  Quelle est   la capitale  de la France ?  " }],
        ["correct_answer", { correct_answer: "  Paris " }],
        ["a choice", { choices: ["Paris", " Lyon  ", "Marseille", "Toulouse"] }],
    ])("should return the stored question as it is and not ask the repository to update anything when only the %s has extra spaces", (_field, change) => {
        const result = defaultQuestionService.updateQuestion(storedQuestion.id, { ...identicalInput, ...change });

        expect(result).toEqual(storedQuestion);
        expect(questionRepository.update).not.toHaveBeenCalled();
    });
});

describe("US-005/CA-37 - When the service updates an MCQ question whose only change is the order of its choices", () => {
    let result: Question;
    const storedQuestion: Question = {
        id: "019d6cdd-30db-7437-ac57-5826c0695245",
        type: "MCQ",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quelle est la capitale de la France ?",
        choices: ["Paris", "Lyon", "Marseille", "Toulouse"],
        correct_answer: "Paris",
        level: 1,
        time_limit: 30,
        points: 10,
        image_path: null,
        audio_path: null,
        created_at: "2026-04-01T09:00:00.000Z",
        last_updated_at: "2026-04-05T08:00:00.000Z",
    };
    const input: CreateMcqInput = {
        type: "MCQ",
        theme_id: storedQuestion.theme_id,
        title: storedQuestion.title,
        choices: ["Lyon", "Paris", "Marseille", "Toulouse"],
        correct_answer: "Paris",
        level: 1,
        time_limit: 30,
        points: 10,
    };
    const expected: Question = { ...storedQuestion, choices: input.choices, last_updated_at: "2026-04-08T13:32:00.000Z" };

    beforeEach(() => {
        vi.mocked(questionRepository.getById).mockReturnValue(storedQuestion);
        result = defaultQuestionService.updateQuestion(storedQuestion.id, input);
    });

    it("should return and persist the question with the new order and last_updated_at set to now", () => {
        expect(result).toEqual(expected);
        expect(questionRepository.update).toHaveBeenCalledWith(expected);
    });
});

describe("US-005/CA-37 - When the service updates a SPEED question changing exactly one field", () => {
    const storedQuestion: Question = {
        id: "019d6cdd-30db-7437-ac57-5826c0695243",
        type: "SPEED",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quel est le plus grand océan du monde ?",
        correct_answer: "Pacifique",
        level: 2,
        time_limit: 20,
        points: 15,
        image_path: null,
        audio_path: null,
        created_at: "2026-04-01T09:00:00.000Z",
        last_updated_at: "2026-04-05T08:00:00.000Z",
    };
    const identicalInput: CreateSpeedInput = {
        type: "SPEED",
        theme_id: storedQuestion.theme_id,
        title: storedQuestion.title,
        correct_answer: storedQuestion.correct_answer,
        level: 2,
        time_limit: 20,
        points: 15,
    };

    beforeEach(() => {
        vi.mocked(questionRepository.getById).mockReturnValue(storedQuestion);
    });

    it.each([
        ["theme_id", { theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9b" }],
        ["title", { title: "Quel est le plus petit océan du monde ?" }],
        ["correct_answer", { correct_answer: "Atlantique" }],
        ["level", { level: 3 }],
        ["time_limit", { time_limit: 25 }],
        ["points", { points: 20 }],
    ])("should persist the question with last_updated_at set to now when only %s differs", (_field, change) => {
        const input: CreateSpeedInput = { ...identicalInput, ...change };

        const result = defaultQuestionService.updateQuestion(storedQuestion.id, input);

        const expected: Question = { ...storedQuestion, ...change, last_updated_at: "2026-04-08T13:32:00.000Z" };
        expect(result).toEqual(expected);
        expect(questionRepository.update).toHaveBeenCalledWith(expected);
    });
});

describe("US-005/CA-40 - When the service is asked to update a question by an unknown id", () => {
    const id = "018e4f5a-0000-0000-0000-000000000000";
    const input: CreateMcqInput = {
        type: "MCQ",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Question inexistante à modifier ?",
        choices: ["Oui", "Non", "Peut-être", "Jamais"],
        correct_answer: "Oui",
        level: 1,
        time_limit: 30,
        points: 10,
    };

    beforeEach(() => {
        questionRepository.getById = vi.fn().mockReturnValue(undefined);
    });

    it("should reject with a NotFoundError", () => {
        expect(() => defaultQuestionService.updateQuestion(id, input)).toThrow(NotFoundError);
    });

    it("should not ask the repository to update anything", () => {
        expect(() => defaultQuestionService.updateQuestion(id, input)).toThrow();

        expect(questionRepository.update).not.toHaveBeenCalled();
    });
});

describe("US-005/CA-36 - When the service updates a SPEED question with an MCQ body", () => {
    const storedQuestion: Question = {
        id: "019d6cdd-30db-7437-ac57-5826c0695226",
        type: "SPEED",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quel est le plus grand océan du monde ?",
        correct_answer: "Pacifique",
        level: 2,
        time_limit: 15,
        points: 20,
        image_path: null,
        audio_path: null,
        created_at: "2026-04-01T09:00:00.000Z",
        last_updated_at: null,
    };
    const input: CreateMcqInput = {
        type: "MCQ",
        theme_id: storedQuestion.theme_id,
        title: storedQuestion.title,
        choices: ["Pacifique", "Atlantique", "Indien", "Arctique"],
        correct_answer: "Pacifique",
        level: 2,
        time_limit: 15,
        points: 20,
    };

    beforeEach(() => {
        vi.mocked(questionRepository.getById).mockReturnValue(storedQuestion);
    });

    it("should reject with a TypeChangeNotAllowedError", () => {
        expect(() => defaultQuestionService.updateQuestion(storedQuestion.id, input)).toThrow(TypeChangeNotAllowedError);
    });

    it("should not ask the repository to update anything", () => {
        expect(() => defaultQuestionService.updateQuestion(storedQuestion.id, input)).toThrow();

        expect(questionRepository.update).not.toHaveBeenCalled();
    });
});

describe("US-005/CA-36 - When the service updates an MCQ question with a SPEED body", () => {
    const storedQuestion: Question = {
        id: "019d6cdd-30db-7437-ac57-5826c0695227",
        type: "MCQ",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quelle est la capitale de la France ?",
        choices: ["Paris", "Lyon", "Marseille", "Toulouse"],
        correct_answer: "Paris",
        level: 1,
        time_limit: 30,
        points: 10,
        image_path: null,
        audio_path: null,
        created_at: "2026-04-01T09:00:00.000Z",
        last_updated_at: null,
    };
    const speedBody: CreateSpeedInput = {
        type: "SPEED",
        theme_id: storedQuestion.theme_id,
        title: storedQuestion.title,
        correct_answer: "Paris",
        level: 1,
        time_limit: 30,
        points: 10,
    };

    beforeEach(() => {
        vi.mocked(questionRepository.getById).mockReturnValue(storedQuestion);
    });

    it("should reject with a TypeChangeNotAllowedError and not ask the repository to update anything", () => {
        expect(() => defaultQuestionService.updateQuestion(storedQuestion.id, speedBody)).toThrow(TypeChangeNotAllowedError);
        expect(questionRepository.update).not.toHaveBeenCalled();
    });
});

describe("US-005/CA-43 - When the service updates a question with a type that is absent or not MCQ or SPEED", () => {
    const storedQuestion: Question = {
        id: "019d6cdd-30db-7437-ac57-5826c0695229",
        type: "MCQ",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quelle est la capitale du Portugal ?",
        choices: ["Lisbonne", "Porto", "Faro", "Braga"],
        correct_answer: "Lisbonne",
        level: 1,
        time_limit: 30,
        points: 10,
        image_path: null,
        audio_path: null,
        created_at: "2026-04-01T09:00:00.000Z",
        last_updated_at: null,
    };
    const bodyWithoutType = {
        theme_id: storedQuestion.theme_id,
        title: storedQuestion.title,
        choices: ["Lisbonne", "Porto", "Faro", "Braga"],
        correct_answer: "Lisbonne",
        level: 1,
        time_limit: 30,
        points: 10,
    };

    beforeEach(() => {
        vi.mocked(questionRepository.getById).mockReturnValue(storedQuestion);
    });

    it.each([
        ["absent", bodyWithoutType],
        ["FOO", { ...bodyWithoutType, type: "FOO" }],
    ])("should reject a type %s with a ValidationError and not ask the repository to update anything", (_label, body) => {
        const input = body as unknown as CreateQuestionInput;

        expect(() => defaultQuestionService.updateQuestion(storedQuestion.id, input)).toThrow(ValidationError);
        expect(() => defaultQuestionService.updateQuestion(storedQuestion.id, input)).toThrow("Question type must be MCQ or SPEED.");
        expect(questionRepository.update).not.toHaveBeenCalled();
    });

    it("should report the invalid type before looking for the question", () => {
        vi.mocked(questionRepository.getById).mockReturnValue(undefined);
        const input = { ...bodyWithoutType, type: "FOO" } as unknown as CreateQuestionInput;

        expect(() => defaultQuestionService.updateQuestion(storedQuestion.id, input)).toThrow(ValidationError);
    });
});

describe("US-005/CA-42 - When the service updates a question with a body carrying fields outside the allowed ones", () => {
    const storedQuestion: Question = {
        id: "019d6cdd-30db-7437-ac57-5826c0695229",
        type: "MCQ",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quelle est la capitale du Portugal ?",
        choices: ["Lisbonne", "Porto", "Faro", "Braga"],
        correct_answer: "Lisbonne",
        level: 1,
        time_limit: 30,
        points: 10,
        image_path: "images/portugal.png",
        audio_path: null,
        created_at: "2026-04-01T09:00:00.000Z",
        last_updated_at: null,
    };
    const validBody: CreateMcqInput = {
        type: "MCQ",
        theme_id: storedQuestion.theme_id,
        title: "Quelle est la capitale de l'Espagne ?",
        choices: ["Madrid", "Rome", "Vienne", "Oslo"],
        correct_answer: "Madrid",
        level: 4,
        time_limit: 45,
        points: 20,
    };

    beforeEach(() => {
        vi.mocked(questionRepository.getById).mockReturnValue(storedQuestion);
    });

    it.each(["image_path", "audio_path", "difficulty"])("should reject a body containing %s with an UnknownFieldsError naming it and not ask the repository to update anything", (field) => {
        const input = { ...validBody, [field]: "/media/portugal" } as unknown as CreateQuestionInput;

        expect(() => defaultQuestionService.updateQuestion(storedQuestion.id, input)).toThrow(UnknownFieldsError);
        expect(() => defaultQuestionService.updateQuestion(storedQuestion.id, input)).toThrow(`Unknown field(s): ${field}.`);
        expect(questionRepository.update).not.toHaveBeenCalled();
    });

    it("should name every unknown field in the order they appear in the body", () => {
        const input = { ...validBody, difficulty: "hard", hint: "Tage", image_path: "/media/x" } as unknown as CreateQuestionInput;

        expect(() => defaultQuestionService.updateQuestion(storedQuestion.id, input)).toThrow("Unknown field(s): difficulty, hint, image_path.");
    });

    it("should accept an id in the body", () => {
        const input = { ...validBody, id: storedQuestion.id } as unknown as CreateQuestionInput;

        expect(() => defaultQuestionService.updateQuestion(storedQuestion.id, input)).not.toThrow();
    });

    it("should report the unknown field before looking for the question", () => {
        vi.mocked(questionRepository.getById).mockReturnValue(undefined);
        const input = { ...validBody, image_path: "/media/x" } as unknown as CreateQuestionInput;

        expect(() => defaultQuestionService.updateQuestion(storedQuestion.id, input)).toThrow(UnknownFieldsError);
    });

    it("should report an invalid type before an unknown field", () => {
        const input = { ...validBody, type: "FOO", image_path: "/media/x" } as unknown as CreateQuestionInput;

        expect(() => defaultQuestionService.updateQuestion(storedQuestion.id, input)).toThrow(ValidationError);
    });
});

describe("US-005/CA-43 - When the service updates a question with a body missing a business field", () => {
    const storedMcq: Question = {
        id: "019d6cdd-30db-7437-ac57-5826c0695229",
        type: "MCQ",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quelle est la capitale du Portugal ?",
        choices: ["Lisbonne", "Porto", "Faro", "Braga"],
        correct_answer: "Lisbonne",
        level: 1,
        time_limit: 30,
        points: 10,
        image_path: null,
        audio_path: null,
        created_at: "2026-04-01T09:00:00.000Z",
        last_updated_at: null,
    };
    const storedSpeed: Question = {
        id: "019d6cdd-30db-7437-ac57-5826c0695230",
        type: "SPEED",
        theme_id: storedMcq.theme_id,
        title: "Quel fleuve traverse Lisbonne ?",
        correct_answer: "Tage",
        level: 1,
        time_limit: 30,
        points: 10,
        image_path: null,
        audio_path: null,
        created_at: "2026-04-01T09:00:00.000Z",
        last_updated_at: null,
    };
    const validMcqBody: CreateMcqInput = {
        type: "MCQ",
        theme_id: storedMcq.theme_id,
        title: "Quelle est la capitale de l'Espagne ?",
        choices: ["Madrid", "Rome", "Vienne", "Oslo"],
        correct_answer: "Madrid",
        level: 4,
        time_limit: 45,
        points: 20,
    };
    const validSpeedBody: CreateSpeedInput = {
        type: "SPEED",
        theme_id: storedMcq.theme_id,
        title: "Quel fleuve traverse Madrid ?",
        correct_answer: "Manzanares",
        level: 4,
        time_limit: 45,
        points: 20,
    };

    beforeEach(() => {
        vi.mocked(questionRepository.getById).mockReturnValue(storedMcq);
    });

    const without = (body: object, ...fields: string[]): object => Object.fromEntries(Object.entries(body).filter(([key]) => !fields.includes(key)));

    const missingValues: [string, (body: object, field: string) => object][] = [
        ["absent", (body, field) => without(body, field)],
        ["null", (body, field) => ({ ...body, [field]: null })],
    ];

    describe.each(["theme_id", "title", "choices", "correct_answer", "level", "time_limit", "points"])("%s", (field) => {
        it.each(missingValues)("should reject an MCQ body where it is %s with a ValidationError naming it and not ask the repository to update anything", (_label, remove) => {
            const input = remove(validMcqBody, field) as unknown as CreateQuestionInput;

            expect(() => defaultQuestionService.updateQuestion(storedMcq.id, input)).toThrow(ValidationError);
            expect(() => defaultQuestionService.updateQuestion(storedMcq.id, input)).toThrow(`Question ${field} is required.`);
            expect(questionRepository.update).not.toHaveBeenCalled();
        });
    });

    it.each(["theme_id", "title", "correct_answer", "level", "time_limit", "points"])("should reject a SPEED body without %s", (field) => {
        vi.mocked(questionRepository.getById).mockReturnValue(storedSpeed);
        const input = without(validSpeedBody, field) as unknown as CreateQuestionInput;

        expect(() => defaultQuestionService.updateQuestion(storedSpeed.id, input)).toThrow(`Question ${field} is required.`);
        expect(questionRepository.update).not.toHaveBeenCalled();
    });

    it("should name the first missing field in the order theme_id, title, choices, correct_answer, level, time_limit, points", () => {
        const input = without(validMcqBody, "points", "title") as unknown as CreateQuestionInput;

        expect(() => defaultQuestionService.updateQuestion(storedMcq.id, input)).toThrow("Question title is required.");
    });

    it("should accept a SPEED body without choices", () => {
        vi.mocked(questionRepository.getById).mockReturnValue(storedSpeed);

        expect(() => defaultQuestionService.updateQuestion(storedSpeed.id, validSpeedBody)).not.toThrow();
    });

    it("should report a missing field before looking for the question", () => {
        vi.mocked(questionRepository.getById).mockReturnValue(undefined);
        const input = without(validMcqBody, "title") as unknown as CreateQuestionInput;

        expect(() => defaultQuestionService.updateQuestion(storedMcq.id, input)).toThrow(ValidationError);
    });

    it("should report an unknown field before a missing field", () => {
        const input = { ...without(validMcqBody, "title"), image_path: "/media/x" } as unknown as CreateQuestionInput;

        expect(() => defaultQuestionService.updateQuestion(storedMcq.id, input)).toThrow(UnknownFieldsError);
    });
});

describe("US-005/CA-39 - When the service updates a question with the title of another question", () => {
    const storedQuestion: Question = {
        id: "019d6cdd-30db-7437-ac57-5826c0695228",
        type: "MCQ",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quelle est la capitale de l'Espagne ?",
        choices: ["Madrid", "Rome", "Vienne", "Oslo"],
        correct_answer: "Madrid",
        level: 1,
        time_limit: 30,
        points: 10,
        image_path: null,
        audio_path: null,
        created_at: "2026-04-01T09:00:00.000Z",
        last_updated_at: null,
    };
    const otherQuestion: Question = {
        ...storedQuestion,
        id: "019d6cdd-30db-7437-ac57-5826c0695229",
        title: "Quelle est la capitale de la France ?",
        choices: ["Paris", "Lyon", "Marseille", "Toulouse"],
        correct_answer: "Paris",
    };
    const input: CreateMcqInput = {
        type: "MCQ",
        theme_id: storedQuestion.theme_id,
        title: otherQuestion.title,
        choices: ["Paris", "Lyon", "Marseille", "Toulouse"],
        correct_answer: "Paris",
        level: 1,
        time_limit: 30,
        points: 10,
    };

    beforeEach(() => {
        vi.mocked(questionRepository.getById).mockReturnValue(storedQuestion);
        vi.mocked(questionRepository.getByTitle).mockReturnValue(otherQuestion);
    });

    it("should reject with a ConflictError and not ask the repository to update anything", () => {
        expect(() => defaultQuestionService.updateQuestion(storedQuestion.id, input)).toThrow(ConflictError);
        expect(questionRepository.update).not.toHaveBeenCalled();
    });
});

describe("US-005/CA-39 - When the service updates a SPEED question with the title of another question", () => {
    const storedQuestion: Question = {
        id: "019d6cdd-30db-7437-ac57-5826c0695231",
        type: "SPEED",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quel est le plus grand océan du monde ?",
        correct_answer: "Pacifique",
        level: 2,
        time_limit: 20,
        points: 15,
        image_path: null,
        audio_path: null,
        created_at: "2026-04-01T09:00:00.000Z",
        last_updated_at: null,
    };
    const otherQuestion: Question = {
        ...storedQuestion,
        id: "019d6cdd-30db-7437-ac57-5826c0695232",
        title: "Quel est le plus long fleuve du monde ?",
        correct_answer: "Nil",
    };
    const input: CreateSpeedInput = {
        type: "SPEED",
        theme_id: storedQuestion.theme_id,
        title: otherQuestion.title,
        correct_answer: "Nil",
        level: 2,
        time_limit: 20,
        points: 15,
    };

    beforeEach(() => {
        vi.mocked(questionRepository.getById).mockReturnValue(storedQuestion);
        vi.mocked(questionRepository.getByTitle).mockReturnValue(otherQuestion);
    });

    it("should reject with a ConflictError and not ask the repository to update anything", () => {
        expect(() => defaultQuestionService.updateQuestion(storedQuestion.id, input)).toThrow(ConflictError);
        expect(questionRepository.update).not.toHaveBeenCalled();
    });
});

describe("US-005/CA-39 - When the service updates a question and keeps its own title", () => {
    const storedQuestion: Question = {
        id: "019d6cdd-30db-7437-ac57-5826c0695230",
        type: "MCQ",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quelle est la capitale de la France ?",
        choices: ["Paris", "Lyon", "Marseille", "Toulouse"],
        correct_answer: "Paris",
        level: 1,
        time_limit: 30,
        points: 10,
        image_path: null,
        audio_path: null,
        created_at: "2026-04-01T09:00:00.000Z",
        last_updated_at: null,
    };
    const input: CreateMcqInput = {
        type: "MCQ",
        theme_id: storedQuestion.theme_id,
        title: storedQuestion.title,
        choices: ["Paris", "Lyon", "Marseille", "Toulouse"],
        correct_answer: "Paris",
        level: 5,
        time_limit: 30,
        points: 10,
    };

    beforeEach(() => {
        vi.mocked(questionRepository.getById).mockReturnValue(storedQuestion);
        vi.mocked(questionRepository.getByTitle).mockReturnValue(storedQuestion);
    });

    it("should update the question without raising a conflict", () => {
        const result = defaultQuestionService.updateQuestion(storedQuestion.id, input);

        expect(result.level).toBe(5);
        expect(questionRepository.update).toHaveBeenCalledWith(result);
    });
});

describe("US-005/CA-35 - When the service updates a question with a body that breaks a rule of the creation", () => {
    const storedMcq: Question = {
        id: "019d6cdd-30db-7437-ac57-5826c0695240",
        type: "MCQ",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quelle est la capitale du Portugal ?",
        choices: ["Lisbonne", "Porto", "Faro", "Braga"],
        correct_answer: "Lisbonne",
        level: 1,
        time_limit: 30,
        points: 10,
        image_path: null,
        audio_path: null,
        created_at: "2026-04-01T09:00:00.000Z",
        last_updated_at: null,
    };
    const validMcqBody: CreateMcqInput = {
        type: "MCQ",
        theme_id: storedMcq.theme_id,
        title: "Quelle est la capitale de l'Espagne ?",
        choices: ["Madrid", "Rome", "Vienne", "Oslo"],
        correct_answer: "Madrid",
        level: 4,
        time_limit: 45,
        points: 20,
    };

    beforeEach(() => {
        vi.mocked(questionRepository.getById).mockReturnValue(storedMcq);
    });

    describe("title", () => {
        it.each([
            ["shorter than 10 characters", "Trop cour", "Question title must be at least 10 characters long."],
            ["longer than 250 characters", "Q" + "a".repeat(250), "Question title must be at most 250 characters long."],
            ["not starting with an uppercase letter", "quelle est la capitale de l'Espagne ?", "Question title must start with an uppercase letter."],
        ])("should reject a title %s with the ValidationError of the creation and not ask the repository to update anything", (_label, title, message) => {
            const input = { ...validMcqBody, title };

            expect(() => defaultQuestionService.updateQuestion(storedMcq.id, input)).toThrow(ValidationError);
            expect(() => defaultQuestionService.updateQuestion(storedMcq.id, input)).toThrow(message);
            expect(questionRepository.update).not.toHaveBeenCalled();
        });

        it("should judge the length of the title after trimming and collapsing spaces", () => {
            const input = { ...validMcqBody, title: "   Trop   cour   " };

            expect(() => defaultQuestionService.updateQuestion(storedMcq.id, input)).toThrow("Question title must be at least 10 characters long.");
        });

        it("should persist the title without leading, trailing or repeated spaces", () => {
            const input = { ...validMcqBody, title: "  Quelle   est la capitale   de l'Espagne ?  " };

            const result = defaultQuestionService.updateQuestion(storedMcq.id, input);

            expect(result.title).toBe("Quelle est la capitale de l'Espagne ?");
            expect(questionRepository.update).toHaveBeenCalledWith(result);
        });

        it("should look for a homonym with the normalized title", () => {
            const otherQuestion: Question = { ...storedMcq, id: "019d6cdd-30db-7437-ac57-5826c0695241", title: "Quelle est la capitale de l'Espagne ?" };
            vi.mocked(questionRepository.getByTitle).mockImplementation(title => title === otherQuestion.title ? otherQuestion : undefined);
            const input = { ...validMcqBody, title: "  Quelle   est la capitale   de l'Espagne ?  " };

            expect(() => defaultQuestionService.updateQuestion(storedMcq.id, input)).toThrow(ConflictError);
            expect(questionRepository.update).not.toHaveBeenCalled();
        });
    });

    describe("MCQ choices and correct_answer", () => {
        it.each([
            ["fewer than 4 choices", ["Madrid", "Rome", "Vienne"], "Madrid", "Question choices must contain exactly 4 entries."],
            ["more than 4 choices", ["Madrid", "Rome", "Vienne", "Oslo", "Lima"], "Madrid", "Question choices must contain exactly 4 entries."],
            ["an empty choice", ["Madrid", "", "Vienne", "Oslo"], "Madrid", "Question choices must each be between 1 and 40 characters."],
            ["a blank choice", ["Madrid", "   ", "Vienne", "Oslo"], "Madrid", "Question choices must each be between 1 and 40 characters."],
            ["a choice longer than 40 characters", ["Madrid", "R".repeat(41), "Vienne", "Oslo"], "Madrid", "Question choices must each be between 1 and 40 characters."],
            ["two choices differing only by case", ["Madrid", "madrid", "Vienne", "Oslo"], "Madrid", "Question choices must be distinct (case-insensitive)."],
            ["two choices equal after trimming", ["Madrid", " Madrid ", "Vienne", "Oslo"], "Madrid", "Question choices must be distinct (case-insensitive)."],
            ["a correct_answer matching no choice", ["Madrid", "Rome", "Vienne", "Oslo"], "Lisbonne", "Question correct_answer must match one of the choices (case-insensitive)."],
        ])("should reject %s with the ValidationError of the creation and not ask the repository to update anything", (_label, choices, correctAnswer, message) => {
            const input = { ...validMcqBody, choices, correct_answer: correctAnswer };

            expect(() => defaultQuestionService.updateQuestion(storedMcq.id, input)).toThrow(ValidationError);
            expect(() => defaultQuestionService.updateQuestion(storedMcq.id, input)).toThrow(message);
            expect(questionRepository.update).not.toHaveBeenCalled();
        });

        it("should persist trimmed choices and a trimmed correct_answer that matches a choice by case only", () => {
            const input = { ...validMcqBody, choices: [" Madrid ", "Rome  ", "  Vienne", "Oslo"], correct_answer: "  madrid " };

            const result = defaultQuestionService.updateQuestion(storedMcq.id, input);

            if (result.type !== "MCQ") throw new Error("expected MCQ");
            expect(result.choices).toEqual(["Madrid", "Rome", "Vienne", "Oslo"]);
            expect(result.correct_answer).toBe("madrid");
            expect(questionRepository.update).toHaveBeenCalledWith(result);
        });
    });

    describe("SPEED correct_answer", () => {
        const storedSpeed: Question = {
            id: "019d6cdd-30db-7437-ac57-5826c0695242",
            type: "SPEED",
            theme_id: storedMcq.theme_id,
            title: "Quel fleuve traverse Lisbonne ?",
            correct_answer: "Tage",
            level: 1,
            time_limit: 30,
            points: 10,
            image_path: null,
            audio_path: null,
            created_at: "2026-04-01T09:00:00.000Z",
            last_updated_at: null,
        };
        const validSpeedBody: CreateSpeedInput = {
            type: "SPEED",
            theme_id: storedMcq.theme_id,
            title: "Quel fleuve traverse Madrid ?",
            correct_answer: "Manzanares",
            level: 4,
            time_limit: 45,
            points: 20,
        };

        beforeEach(() => {
            vi.mocked(questionRepository.getById).mockReturnValue(storedSpeed);
        });

        it.each([
            ["empty", ""],
            ["only whitespace", "   "],
            ["longer than 40 characters", "M".repeat(41)],
        ])("should reject a correct_answer that is %s and not ask the repository to update anything", (_label, correctAnswer) => {
            const input = { ...validSpeedBody, correct_answer: correctAnswer };

            expect(() => defaultQuestionService.updateQuestion(storedSpeed.id, input)).toThrow(ValidationError);
            expect(() => defaultQuestionService.updateQuestion(storedSpeed.id, input)).toThrow("Question correct_answer must be between 1 and 40 characters.");
            expect(questionRepository.update).not.toHaveBeenCalled();
        });

        it("should persist the correct_answer without surrounding whitespace", () => {
            const input = { ...validSpeedBody, correct_answer: "  Manzanares  " };

            const result = defaultQuestionService.updateQuestion(storedSpeed.id, input);

            expect(result.correct_answer).toBe("Manzanares");
            expect(questionRepository.update).toHaveBeenCalledWith(result);
        });
    });

    describe("level, time_limit and points", () => {
        it.each([
            ["level", 6, "Question level must be an integer between 1 and 5."],
            ["level", 0, "Question level must be an integer between 1 and 5."],
            ["level", 1.5, "Question level must be an integer between 1 and 5."],
            ["time_limit", 61, "Question time_limit must be an integer between 5 and 60 seconds."],
            ["time_limit", 4, "Question time_limit must be an integer between 5 and 60 seconds."],
            ["time_limit", 10.5, "Question time_limit must be an integer between 5 and 60 seconds."],
            ["points", 51, "Question points must be an integer between 1 and 50."],
            ["points", 0, "Question points must be an integer between 1 and 50."],
            ["points", 2.5, "Question points must be an integer between 1 and 50."],
        ])("should reject %s set to %s with the ValidationError of the creation and not ask the repository to update anything", (field, value, message) => {
            const input = { ...validMcqBody, [field]: value };

            expect(() => defaultQuestionService.updateQuestion(storedMcq.id, input)).toThrow(ValidationError);
            expect(() => defaultQuestionService.updateQuestion(storedMcq.id, input)).toThrow(message);
            expect(questionRepository.update).not.toHaveBeenCalled();
        });

        it.each([
            ["level", 1], ["level", 5], ["time_limit", 5], ["time_limit", 60], ["points", 1], ["points", 50],
        ])("should accept %s set to its bound %s", (field, value) => {
            const input = { ...validMcqBody, [field]: value };

            const result = defaultQuestionService.updateQuestion(storedMcq.id, input);

            expect(result[field as "level" | "time_limit" | "points"]).toBe(value);
        });
    });

    describe("order of the checks", () => {
        it("should report an invalid field before looking for the question", () => {
            vi.mocked(questionRepository.getById).mockReturnValue(undefined);
            const input = { ...validMcqBody, level: 99 };

            expect(() => defaultQuestionService.updateQuestion(storedMcq.id, input)).toThrow(ValidationError);
        });

        it("should report an unknown question before a title conflict", () => {
            vi.mocked(questionRepository.getById).mockReturnValue(undefined);
            vi.mocked(questionRepository.getByTitle).mockReturnValue({ ...storedMcq, id: "019d6cdd-30db-7437-ac57-5826c0695243" });

            expect(() => defaultQuestionService.updateQuestion(storedMcq.id, validMcqBody)).toThrow(NotFoundError);
        });

        it("should report an invalid title before an invalid correct_answer", () => {
            const input = { ...validMcqBody, title: "Trop cour", correct_answer: "Lisbonne" };

            expect(() => defaultQuestionService.updateQuestion(storedMcq.id, input)).toThrow("Question title must be at least 10 characters long.");
        });

        it("should report an invalid correct_answer before an invalid level", () => {
            const input = { ...validMcqBody, correct_answer: "Lisbonne", level: 99 };

            expect(() => defaultQuestionService.updateQuestion(storedMcq.id, input)).toThrow("Question correct_answer must match one of the choices (case-insensitive).");
        });
    });
});

describe("US-005/CA-35 - When the service updates a question with a field of the wrong type", () => {
    const storedMcq: Question = {
        id: "019d6cdd-30db-7437-ac57-5826c0695231",
        type: "MCQ",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quelle est la capitale du Portugal ?",
        choices: ["Lisbonne", "Porto", "Faro", "Braga"],
        correct_answer: "Lisbonne",
        level: 1,
        time_limit: 30,
        points: 10,
        image_path: null,
        audio_path: null,
        created_at: "2026-04-01T09:00:00.000Z",
        last_updated_at: null,
    };
    const validMcqBody: CreateMcqInput = {
        type: "MCQ",
        theme_id: storedMcq.theme_id,
        title: "Quelle est la capitale de l'Espagne ?",
        choices: ["Madrid", "Rome", "Vienne", "Oslo"],
        correct_answer: "Madrid",
        level: 4,
        time_limit: 45,
        points: 20,
    };
    const storedSpeed: Question = {
        id: "019d6cdd-30db-7437-ac57-5826c0695232",
        type: "SPEED",
        theme_id: storedMcq.theme_id,
        title: "Quel fleuve traverse Lisbonne ?",
        correct_answer: "Tage",
        level: 1,
        time_limit: 30,
        points: 10,
        image_path: null,
        audio_path: null,
        created_at: "2026-04-01T09:00:00.000Z",
        last_updated_at: null,
    };
    const validSpeedBody: CreateSpeedInput = {
        type: "SPEED",
        theme_id: storedMcq.theme_id,
        title: "Quel fleuve traverse Madrid ?",
        correct_answer: "Manzanares",
        level: 4,
        time_limit: 45,
        points: 20,
    };

    beforeEach(() => {
        vi.mocked(questionRepository.getById).mockReturnValue(storedMcq);
    });

    describe("title", () => {
        it.each([
            ["a number", 42],
            ["a boolean", true],
            ["an array", ["Quelle est la capitale ?"]],
            ["an object", { text: "Quelle est la capitale ?" }],
        ])("should reject a title that is %s with a ValidationError and not ask the repository to update anything", (_label, title) => {
            const input = { ...validMcqBody, title } as unknown as CreateQuestionInput;

            expect(() => defaultQuestionService.updateQuestion(storedMcq.id, input)).toThrow(ValidationError);
            expect(() => defaultQuestionService.updateQuestion(storedMcq.id, input)).toThrow("Question title must be a string.");
            expect(questionRepository.update).not.toHaveBeenCalled();
        });
    });

    describe("correct_answer", () => {
        const notStrings: [string, unknown][] = [
            ["a number", 42],
            ["a boolean", true],
            ["an array", ["Madrid"]],
            ["an object", { text: "Madrid" }],
        ];

        it.each(notStrings)("should reject an MCQ correct_answer that is %s with a ValidationError and not ask the repository to update anything", (_label, correctAnswer) => {
            const input = { ...validMcqBody, correct_answer: correctAnswer } as unknown as CreateQuestionInput;

            expect(() => defaultQuestionService.updateQuestion(storedMcq.id, input)).toThrow(ValidationError);
            expect(() => defaultQuestionService.updateQuestion(storedMcq.id, input)).toThrow("Question correct_answer must be a string.");
            expect(questionRepository.update).not.toHaveBeenCalled();
        });

        it.each(notStrings)("should reject a SPEED correct_answer that is %s with a ValidationError and not ask the repository to update anything", (_label, correctAnswer) => {
            vi.mocked(questionRepository.getById).mockReturnValue(storedSpeed);
            const input = { ...validSpeedBody, correct_answer: correctAnswer } as unknown as CreateQuestionInput;

            expect(() => defaultQuestionService.updateQuestion(storedSpeed.id, input)).toThrow(ValidationError);
            expect(() => defaultQuestionService.updateQuestion(storedSpeed.id, input)).toThrow("Question correct_answer must be a string.");
            expect(questionRepository.update).not.toHaveBeenCalled();
        });

        it("should report a mistyped correct_answer before a mistyped title", () => {
            const input = { ...validMcqBody, title: 42, correct_answer: 42 } as unknown as CreateQuestionInput;

            expect(() => defaultQuestionService.updateQuestion(storedMcq.id, input)).toThrow("Question correct_answer must be a string.");
        });
    });

    describe("choices", () => {
        it.each([
            ["a string", "Madrid"],
            ["a number", 42],
            ["a boolean", true],
            ["an object", { 0: "Madrid" }],
        ])("should reject MCQ choices that are %s with a ValidationError and not ask the repository to update anything", (_label, choices) => {
            const input = { ...validMcqBody, choices } as unknown as CreateQuestionInput;

            expect(() => defaultQuestionService.updateQuestion(storedMcq.id, input)).toThrow(ValidationError);
            expect(() => defaultQuestionService.updateQuestion(storedMcq.id, input)).toThrow("Question choices must be an array.");
            expect(questionRepository.update).not.toHaveBeenCalled();
        });

        it.each([
            ["numbers", [1, 2, 3, 4]],
            ["a single null", ["Madrid", "Rome", "Vienne", null]],
        ])("should reject MCQ choices made of %s with a ValidationError and not ask the repository to update anything", (_label, choices) => {
            const input = { ...validMcqBody, choices } as unknown as CreateQuestionInput;

            expect(() => defaultQuestionService.updateQuestion(storedMcq.id, input)).toThrow(ValidationError);
            expect(() => defaultQuestionService.updateQuestion(storedMcq.id, input)).toThrow("Question choices must contain only strings.");
            expect(questionRepository.update).not.toHaveBeenCalled();
        });

        it("should report mistyped choices before a mistyped title", () => {
            const input = { ...validMcqBody, title: 42, choices: "Madrid" } as unknown as CreateQuestionInput;

            expect(() => defaultQuestionService.updateQuestion(storedMcq.id, input)).toThrow("Question choices must be an array.");
        });

        it("should report a mistyped correct_answer before mistyped choices", () => {
            const input = { ...validMcqBody, correct_answer: 42, choices: "Madrid" } as unknown as CreateQuestionInput;

            expect(() => defaultQuestionService.updateQuestion(storedMcq.id, input)).toThrow("Question correct_answer must be a string.");
        });

        it("should leave the choices of a SPEED body to the rule that forbids them", () => {
            vi.mocked(questionRepository.getById).mockReturnValue(storedSpeed);
            const input = { ...validSpeedBody, choices: "Madrid" } as unknown as CreateQuestionInput;

            expect(() => defaultQuestionService.updateQuestion(storedSpeed.id, input)).toThrow("Question choices must be absent for a SPEED question.");
        });
    });
});

describe("US-005/CA-35 - When the service updates a question with a malformed theme_id", () => {
    const storedMcq: Question = {
        id: "019d6cdd-30db-7437-ac57-5826c0695241",
        type: "MCQ",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quelle est la capitale du Portugal ?",
        choices: ["Lisbonne", "Porto", "Faro", "Braga"],
        correct_answer: "Lisbonne",
        level: 1,
        time_limit: 30,
        points: 10,
        image_path: null,
        audio_path: null,
        created_at: "2026-04-01T09:00:00.000Z",
        last_updated_at: null,
    };
    const validMcqBody: CreateMcqInput = {
        type: "MCQ",
        theme_id: storedMcq.theme_id,
        title: "Quelle est la capitale de l'Espagne ?",
        choices: ["Madrid", "Rome", "Vienne", "Oslo"],
        correct_answer: "Madrid",
        level: 4,
        time_limit: 45,
        points: 20,
    };

    beforeEach(() => {
        vi.mocked(questionRepository.getById).mockReturnValue(storedMcq);
        vi.mocked(uuidValidator.validate).mockReturnValue(false);
    });

    it("should reject with an InvalidUuidError and not ask the repository to update anything", () => {
        const input = { ...validMcqBody, theme_id: "not-a-valid-uuid" };

        expect(() => defaultQuestionService.updateQuestion(storedMcq.id, input)).toThrow(InvalidUuidError);
        expect(questionRepository.update).not.toHaveBeenCalled();
    });

    it("should hand the theme_id of the body to the validator", () => {
        const input = { ...validMcqBody, theme_id: "not-a-valid-uuid" };

        expect(() => defaultQuestionService.updateQuestion(storedMcq.id, input)).toThrow();

        expect(uuidValidator.validate).toHaveBeenCalledWith("not-a-valid-uuid");
    });

    describe("order of the checks", () => {
        it.each([
            ["absent", undefined],
            ["null", null],
        ])("should report a theme_id that is %s as required, before judging its form", (_label, themeId) => {
            const input = { ...validMcqBody, theme_id: themeId } as unknown as CreateQuestionInput;

            expect(() => defaultQuestionService.updateQuestion(storedMcq.id, input)).toThrow(ValidationError);
            expect(() => defaultQuestionService.updateQuestion(storedMcq.id, input)).toThrow("Question theme_id is required.");
            expect(uuidValidator.validate).not.toHaveBeenCalled();
        });

        it("should report an invalid type before the form of theme_id", () => {
            const input = { ...validMcqBody, type: "OPEN" } as unknown as CreateQuestionInput;

            expect(() => defaultQuestionService.updateQuestion(storedMcq.id, input)).toThrow("Question type must be MCQ or SPEED.");
        });

        it("should report unknown fields before the form of theme_id", () => {
            const input = { ...validMcqBody, image_path: "a.png" } as unknown as CreateQuestionInput;

            expect(() => defaultQuestionService.updateQuestion(storedMcq.id, input)).toThrow(UnknownFieldsError);
        });

        it("should report a malformed theme_id before a mistyped title", () => {
            const input = { ...validMcqBody, title: 42 } as unknown as CreateQuestionInput;

            expect(() => defaultQuestionService.updateQuestion(storedMcq.id, input)).toThrow(InvalidUuidError);
        });

        it("should report a malformed theme_id before a title that breaks a rule of the creation", () => {
            const input = { ...validMcqBody, title: "Trop cour" };

            expect(() => defaultQuestionService.updateQuestion(storedMcq.id, input)).toThrow(InvalidUuidError);
        });

        it("should report a malformed theme_id before looking for the question", () => {
            vi.mocked(questionRepository.getById).mockReturnValue(undefined);

            expect(() => defaultQuestionService.updateQuestion(storedMcq.id, validMcqBody)).toThrow(InvalidUuidError);
            expect(questionRepository.getById).not.toHaveBeenCalled();
        });
    });
});

describe("US-005/CA-8 - When the service creates a question with a malformed theme_id", () => {
    const validMcqInput: CreateMcqInput = {
        type: "MCQ",
        theme_id: "not-a-valid-uuid",
        title: "Quelle est la capitale de la France ?",
        choices: ["Paris", "Lyon", "Marseille", "Toulouse"],
        correct_answer: "Paris",
        level: 1,
        time_limit: 30,
        points: 10,
    };

    beforeEach(() => {
        vi.mocked(uuidValidator.validate).mockReturnValue(false);
    });

    it("should reject with an InvalidUuidError and not ask the repository to insert anything", () => {
        expect(() => defaultQuestionService.createQuestion(validMcqInput)).toThrow(InvalidUuidError);
        expect(questionRepository.insert).not.toHaveBeenCalled();
    });

    it("should hand the theme_id of the input to the validator", () => {
        expect(() => defaultQuestionService.createQuestion(validMcqInput)).toThrow();

        expect(uuidValidator.validate).toHaveBeenCalledWith("not-a-valid-uuid");
    });

    it("should report it before an invalid type", () => {
        const input = { ...validMcqInput, type: "OPEN" } as unknown as CreateQuestionInput;

        expect(() => defaultQuestionService.createQuestion(input)).toThrow(InvalidUuidError);
    });

    it("should report it before choices on a SPEED question", () => {
        const input = {
            type: "SPEED",
            theme_id: "not-a-valid-uuid",
            title: "Quelle est la capitale de la France ?",
            choices: ["Paris", "Lyon", "Marseille", "Toulouse"],
            correct_answer: "Paris",
            level: 1,
            time_limit: 30,
            points: 10,
        } as unknown as CreateQuestionInput;

        expect(() => defaultQuestionService.createQuestion(input)).toThrow(InvalidUuidError);
    });

    it("should report it before a theme that does not exist, without asking whether the theme exists", () => {
        vi.mocked(themeExistenceChecker.exists).mockReturnValue(false);

        expect(() => defaultQuestionService.createQuestion(validMcqInput)).toThrow(InvalidUuidError);
        expect(themeExistenceChecker.exists).not.toHaveBeenCalled();
    });
});

describe("US-005/CA-35 - When the service updates a question with a theme_id that references no existing theme", () => {
    const unknownThemeId = "018e4f5a-0000-0000-0000-000000000000";
    const storedMcq: Question = {
        id: "019d6cdd-30db-7437-ac57-5826c0695241",
        type: "MCQ",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quelle est la capitale du Portugal ?",
        choices: ["Lisbonne", "Porto", "Faro", "Braga"],
        correct_answer: "Lisbonne",
        level: 1,
        time_limit: 30,
        points: 10,
        image_path: null,
        audio_path: null,
        created_at: "2026-04-01T09:00:00.000Z",
        last_updated_at: null,
    };
    const validMcqBody: CreateMcqInput = {
        type: "MCQ",
        theme_id: unknownThemeId,
        title: "Quelle est la capitale de l'Espagne ?",
        choices: ["Madrid", "Rome", "Vienne", "Oslo"],
        correct_answer: "Madrid",
        level: 4,
        time_limit: 45,
        points: 20,
    };
    const storedSpeed: Question = {
        id: "019d6cdd-30db-7437-ac57-5826c0695242",
        type: "SPEED",
        theme_id: "018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a",
        title: "Quel est le plus grand océan du monde ?",
        correct_answer: "Pacifique",
        level: 2,
        time_limit: 15,
        points: 20,
        image_path: null,
        audio_path: null,
        created_at: "2026-04-01T09:00:00.000Z",
        last_updated_at: null,
    };

    beforeEach(() => {
        vi.mocked(questionRepository.getById).mockReturnValue(storedMcq);
        vi.mocked(themeExistenceChecker.exists).mockReturnValue(false);
    });

    it("should reject with an InvalidThemeError and not ask the repository to update anything", () => {
        expect(() => defaultQuestionService.updateQuestion(storedMcq.id, validMcqBody)).toThrow(InvalidThemeError);
        expect(questionRepository.update).not.toHaveBeenCalled();
    });

    it("should hand the theme_id of the body to the existence checker", () => {
        expect(() => defaultQuestionService.updateQuestion(storedMcq.id, validMcqBody)).toThrow();

        expect(themeExistenceChecker.exists).toHaveBeenCalledWith(unknownThemeId);
    });

    describe("order of the checks", () => {
        it("should report an unknown question before looking at the theme", () => {
            vi.mocked(questionRepository.getById).mockReturnValue(undefined);

            expect(() => defaultQuestionService.updateQuestion(storedMcq.id, validMcqBody)).toThrow(NotFoundError);
            expect(themeExistenceChecker.exists).not.toHaveBeenCalled();
        });

        it("should report a change of type before looking at the theme", () => {
            vi.mocked(questionRepository.getById).mockReturnValue(storedSpeed);

            expect(() => defaultQuestionService.updateQuestion(storedSpeed.id, validMcqBody)).toThrow(TypeChangeNotAllowedError);
            expect(themeExistenceChecker.exists).not.toHaveBeenCalled();
        });

        it("should report choices on a SPEED body before looking at the theme", () => {
            vi.mocked(questionRepository.getById).mockReturnValue(storedSpeed);
            const input = {
                type: "SPEED",
                theme_id: unknownThemeId,
                title: "Quel est le plus petit océan du monde ?",
                choices: ["Arctique", "Indien", "Atlantique", "Pacifique"],
                correct_answer: "Arctique",
                level: 2,
                time_limit: 15,
                points: 20,
            } as unknown as CreateQuestionInput;

            expect(() => defaultQuestionService.updateQuestion(storedSpeed.id, input)).toThrow("Question choices must be absent for a SPEED question.");
            expect(themeExistenceChecker.exists).not.toHaveBeenCalled();
        });

        it("should report the theme before a title taken by another question, without searching the title", () => {
            vi.mocked(questionRepository.getByTitle).mockReturnValue({ ...storedSpeed, title: validMcqBody.title });

            expect(() => defaultQuestionService.updateQuestion(storedMcq.id, validMcqBody)).toThrow(InvalidThemeError);
            expect(questionRepository.getByTitle).not.toHaveBeenCalled();
        });
    });
});
