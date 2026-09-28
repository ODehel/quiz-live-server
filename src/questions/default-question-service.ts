import { Clock } from "../common/clock.interface";
import { NotFoundError } from "../common/not-found-error";
import { UuidGenerator } from "../common/uuid-generator.interface";
import { BaseQuestion } from "./base-question.interface";
import { ConflictError } from "./conflict-error";
import { CreateMcqInput } from "./create-mcq-input.interface";
import { CreateSpeedInput } from "./create-speed-input.interface";
import { InvalidThemeError } from "./invalid-theme-error";
import { QuestionRepository } from "./question-repository.interface";
import { QuestionService } from "./question-service.interface";
import { Question } from "./question.interface";
import { ThemeExistenceChecker } from "./theme-existence-checker.interface";
import { ValidationError } from "./validation-error";

const CHOICES_COUNT = 4;
const SHORT_TEXT_MIN_LENGTH = 1;
const SHORT_TEXT_MAX_LENGTH = 40;

export type CreateQuestionInput = CreateMcqInput | CreateSpeedInput;

export class DefaultQuestionService implements QuestionService {
    constructor(private clock: Clock, private uuidGenerator: UuidGenerator, private questionRepository: QuestionRepository, private themeExistenceChecker: ThemeExistenceChecker) {
    }

    createQuestion(input: CreateQuestionInput): Question {
        if (input.type !== "MCQ" && input.type !== "SPEED") {
            throw new ValidationError("Question type must be MCQ or SPEED.");
        }

        const title = this.validateTitle(this.normalizeTitle(input.title));

        if (input.correct_answer == null) {
            throw new ValidationError("Question correct_answer is required.");
        }
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

        this.validateIntegerRange("level", input.level, 1, 5);
        this.validateIntegerRange("time_limit", input.time_limit, 5, 60, " seconds");
        this.validateIntegerRange("points", input.points, 1, 50);

        if (!this.themeExistenceChecker.exists(input.theme_id)) {
            throw new InvalidThemeError();
        }

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

    getQuestionById(id: string): Question {
        const question = this.questionRepository.getById(id);

        if (question === undefined) {
            throw new NotFoundError();
        }

        return question;
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
