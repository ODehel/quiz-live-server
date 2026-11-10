import { Clock } from "../common/clock.interface";
import { NotFoundError } from "../common/not-found-error";
import { buildPagination } from "../common/build-pagination";
import { Pagination } from "../common/pagination.interface";
import { UuidGenerator } from "../common/uuid-generator.interface";
import { BaseQuestion } from "./base-question.interface";
import { ConflictError } from "./conflict-error";
import { CreateMcqInput } from "./create-mcq-input.interface";
import { CreateSpeedInput } from "./create-speed-input.interface";
import { InvalidThemeError } from "./invalid-theme-error";
import { InvalidUuidError } from "./invalid-uuid-error";
import { UuidValidator } from "../common/uuid-validator.interface";
import { QuestionRepository } from "./question-repository.interface";
import { QuestionService } from "./question-service.interface";
import { Question } from "./question.interface";
import { ThemeExistenceChecker } from "./theme-existence-checker.interface";
import { TypeChangeNotAllowedError } from "./type-change-not-allowed-error";
import { UnknownFieldsError } from "./unknown-fields-error";
import { ValidationError } from "./validation-error";

const CHOICES_COUNT = 4;
const SHORT_TEXT_MIN_LENGTH = 1;
const SHORT_TEXT_MAX_LENGTH = 40;
const UPDATE_ALLOWED_FIELDS = ["id", "type", "theme_id", "title", "correct_answer", "choices", "level", "time_limit", "points"];
const UPDATE_REQUIRED_SPEED_FIELDS = ["theme_id", "title", "correct_answer", "level", "time_limit", "points"];
const UPDATE_REQUIRED_MCQ_FIELDS = ["theme_id", "title", "choices", "correct_answer", "level", "time_limit", "points"];

export type CreateQuestionInput = CreateMcqInput | CreateSpeedInput;

export class DefaultQuestionService implements QuestionService {
    constructor(private clock: Clock, private uuidGenerator: UuidGenerator, private questionRepository: QuestionRepository, private themeExistenceChecker: ThemeExistenceChecker, private uuidValidator: UuidValidator) {
    }

    createQuestion(input: CreateQuestionInput): Question {
        this.rejectMalformedThemeId(input);

        this.rejectInvalidType(input);

        this.rejectChoicesOnSpeed(input);

        const { title, correctAnswer: trimmedCorrectAnswer } = this.validateFields(input);

        this.rejectUnknownTheme(input);

        if (this.questionRepository.getByTitle(title) !== undefined) {
            throw new ConflictError();
        }

        const base: BaseQuestion = {
            id: this.uuidGenerator.generate(),
            theme_id: input.theme_id,
            title: title,
            correct_answer: trimmedCorrectAnswer,
            level: input.level,
            time_limit: input.time_limit,
            points: input.points,
            image_path: null,
            audio_path: null,
            created_at: this.clock.now().toISOString(),
            last_updated_at: null
        };

        const question: Question =
            input.type === "MCQ"
                ? { ...base, type: "MCQ", choices: input.choices.map(c => c.trim()) }
                : { ...base, type: "SPEED" };

        this.questionRepository.insert(question);

        return question;
    }

    updateQuestion(id: string, input: CreateQuestionInput): Question {
        this.rejectInvalidType(input);

        this.rejectUnknownFields(input);

        this.rejectMissingFields(input);

        this.rejectMalformedThemeId(input);

        const { title, correctAnswer } = this.validateFields(input);

        const existing = this.getExistingQuestion(id);

        if (input.type !== existing.type) {
            throw new TypeChangeNotAllowedError();
        }

        this.rejectChoicesOnSpeed(input);

        this.rejectUnknownTheme(input);

        const sameTitle = this.questionRepository.getByTitle(title);

        if (sameTitle !== undefined && sameTitle.id !== id) {
            throw new ConflictError();
        }

        if (this.carriesTheStoredData(input, existing, title, correctAnswer)) {
            return existing;
        }

        const updatedFields = {
            theme_id: input.theme_id,
            title: title,
            correct_answer: correctAnswer,
            level: input.level,
            time_limit: input.time_limit,
            points: input.points,
            last_updated_at: this.clock.now().toISOString()
        };

        const updated: Question =
            input.type === "MCQ"
                ? { ...existing, ...updatedFields, type: "MCQ", choices: input.choices.map(c => c.trim()) }
                : { ...existing, ...updatedFields, type: "SPEED" };

        this.questionRepository.update(updated);

        return updated;
    }

    getQuestionById(id: string): Question {
        return this.getExistingQuestion(id);
    }

    getAll(page: number, limit: number): Pagination<Question> {
        const questions: Question[] = this.questionRepository.getAll(page, limit);
        const total: number = this.questionRepository.count();
        return buildPagination(questions, page, limit, total);
    }

    deleteQuestion(id: string): void {
        this.getExistingQuestion(id);

        this.questionRepository.delete(id);
    }

    private getExistingQuestion(id: string): Question {
        const question = this.questionRepository.getById(id);

        if (question === undefined) {
            throw new NotFoundError();
        }

        return question;
    }

    private carriesTheStoredData(input: CreateQuestionInput, existing: Question, title: string, correctAnswer: string): boolean {
        const sameChoices = input.type !== "MCQ" || existing.type !== "MCQ"
            || (input.choices.length === existing.choices.length && input.choices.every((choice, index) => choice.trim() === existing.choices[index]));

        return input.theme_id === existing.theme_id
            && title === existing.title
            && correctAnswer === existing.correct_answer
            && input.level === existing.level
            && input.time_limit === existing.time_limit
            && input.points === existing.points
            && sameChoices;
    }

    private rejectInvalidType(input: CreateQuestionInput): void {
        if (input.type !== "MCQ" && input.type !== "SPEED") {
            throw new ValidationError("Question type must be MCQ or SPEED.");
        }
    }

    private rejectUnknownFields(input: CreateQuestionInput): void {
        const unknownFields = Object.keys(input).filter(field => !UPDATE_ALLOWED_FIELDS.includes(field));
        if (unknownFields.length > 0) {
            throw new UnknownFieldsError(unknownFields);
        }
    }

    private rejectMissingFields(input: CreateQuestionInput): void {
        const required = input.type === "MCQ" ? UPDATE_REQUIRED_MCQ_FIELDS : UPDATE_REQUIRED_SPEED_FIELDS;
        const record = input as unknown as Record<string, unknown>;
        const missing = required.find(field => record[field] === undefined || record[field] === null);
        if (missing !== undefined) {
            throw new ValidationError(`Question ${missing} is required.`);
        }
    }

    private rejectMalformedThemeId(input: CreateQuestionInput): void {
        if (!this.uuidValidator.validate(input.theme_id)) {
            throw new InvalidUuidError();
        }
    }

    private rejectUnknownTheme(input: CreateQuestionInput): void {
        if (!this.themeExistenceChecker.exists(input.theme_id)) {
            throw new InvalidThemeError();
        }
    }

    private rejectChoicesOnSpeed(input: CreateQuestionInput): void {
        if (input.type === "SPEED" && "choices" in input) {
            throw new ValidationError("Question choices must be absent for a SPEED question.");
        }
    }

    private normalizeTitle(title: string): string {
        return title.trim().replace(/ +/g, " ");
    }

    private validateTitle(title: string): string {
        if (title.length < 10) {
            throw new ValidationError("Question title must be at least 10 characters long.");
        }
        if (title.length > 250) {
            throw new ValidationError("Question title must be at most 250 characters long.");
        }
        if (!/^\p{Lu}/u.test(title)) {
            throw new ValidationError("Question title must start with an uppercase letter.");
        }

        return title;
    }

    private rejectInvalidFieldTypes(input: CreateQuestionInput): void {
        if (typeof input.correct_answer !== "string") {
            throw new ValidationError("Question correct_answer must be a string.");
        }

        if (input.type === "MCQ") {
            if (!Array.isArray(input.choices)) {
                throw new ValidationError("Question choices must be an array.");
            }
            if (input.choices.some(c => typeof c !== "string")) {
                throw new ValidationError("Question choices must contain only strings.");
            }
        }

        if (typeof input.title !== "string") {
            throw new ValidationError("Question title must be a string.");
        }
    }

    private validateFields(input: CreateQuestionInput): { title: string, correctAnswer: string } {
        this.rejectInvalidFieldTypes(input);

        const title = this.validateTitle(this.normalizeTitle(input.title));

        const correctAnswer = this.validateAnswers(input);

        this.validateIntegerRange("level", input.level, 1, 5);
        this.validateIntegerRange("time_limit", input.time_limit, 5, 60, " seconds");
        this.validateIntegerRange("points", input.points, 1, 50);

        return { title, correctAnswer };
    }

    private validateAnswers(input: CreateQuestionInput): string {
        const trimmedCorrectAnswer = input.correct_answer.trim();
        if (input.type === "SPEED") {
            if (this.isInvalidShortTextLength(trimmedCorrectAnswer)) {
                throw new ValidationError(`Question correct_answer must be between ${SHORT_TEXT_MIN_LENGTH} and ${SHORT_TEXT_MAX_LENGTH} characters.`);
            }
        } else {
            const trimmedChoices = input.choices.map(c => c.trim());
            this.validateChoices(trimmedChoices);

            if (trimmedChoices.every(c => c.toLowerCase() !== trimmedCorrectAnswer.toLowerCase())) {
                throw new ValidationError("Question correct_answer must match one of the choices (case-insensitive).");
            }
        }

        return trimmedCorrectAnswer;
    }

    private validateChoices(choices: string[]): void {
        if (choices.length !== CHOICES_COUNT) {
            throw new ValidationError(`Question choices must contain exactly ${CHOICES_COUNT} entries.`);
        }
        if (choices.some(c => this.isInvalidShortTextLength(c))) {
            throw new ValidationError(`Question choices must each be between ${SHORT_TEXT_MIN_LENGTH} and ${SHORT_TEXT_MAX_LENGTH} characters.`);
        }
        if (new Set(choices.map(c => c.toLowerCase())).size !== choices.length) {
            throw new ValidationError("Question choices must be distinct (case-insensitive).");
        }
    }

    private isInvalidShortTextLength(value: string): boolean {
        return value.length < SHORT_TEXT_MIN_LENGTH || value.length > SHORT_TEXT_MAX_LENGTH;
    }

    private isOutOfRangeOrNotInteger(value: number, min: number, max: number): boolean {
        return !Number.isInteger(value) || value < min || value > max;
    }

    private validateIntegerRange(field: string, value: number, min: number, max: number, suffix: string = ""): void {
        if (this.isOutOfRangeOrNotInteger(value, min, max)) {
            throw new ValidationError(`Question ${field} must be an integer between ${min} and ${max}${suffix}.`);
        }
    }
}
