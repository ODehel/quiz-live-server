import { Clock } from "../common/clock.interface";
import { UuidGenerator } from "../common/uuid-generator.interface";
import { BaseQuestion } from "./base-question.interface";
import { ConflictError } from "./conflict-error";
import { CreateMcqInput } from "./create-mcq-input.interface";
import { CreateSpeedInput } from "./create-speed-input.interface";
import { InvalidThemeError } from "./invalid-theme-error";
import { QuestionRepository } from "./question-repository.interface";
import { Question } from "./question.interface";
import { ThemeExistenceChecker } from "./theme-existence-checker.interface";
import { ValidationError } from "./validation-error";

type CreateQuestionInput = CreateMcqInput | CreateSpeedInput;

export class DefaultQuestionService {
    constructor(private clock: Clock, private uuidGenerator: UuidGenerator, private questionRepository: QuestionRepository, private themeExistenceChecker: ThemeExistenceChecker) {
    }

    createQuestion(input: CreateQuestionInput): Question {
        const title = this.validateTitle(this.normalizeTitle(input.title));
        const trimmedCorrectAnswer = input.correct_answer.trim();

        if (this.isInvalidShortTextLength(trimmedCorrectAnswer)) {
            throw new ValidationError();
        }

        if (input.type === "MCQ") {
            const trimmedChoices = input.choices.map(c => c.trim());
            this.validateChoices(trimmedChoices);

            if (trimmedChoices.every(c => c.toLowerCase() !== trimmedCorrectAnswer.toLowerCase())) {
                throw new ValidationError();
            }
        }

        if (input.level < 1 || input.level > 5 || !Number.isInteger(input.level)) {
            throw new ValidationError();
        }

        if (input.time_limit < 5 || input.time_limit > 60 || !Number.isInteger(input.time_limit)) {
            throw new ValidationError();
        }

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

    private normalizeTitle(title: string): string {
        return title.trim().replace(/ +/g, " ");
    }

    private validateTitle(title: string): string {
        if (title.length < 10 || title.length > 250 || !/^\p{Lu}/u.test(title)) {
            throw new ValidationError();
        }
        return title;
    }

    private validateChoices(choices: string[]): void {
        if (choices.length !== 4 || choices.some(c => this.isInvalidShortTextLength(c))) {
            throw new ValidationError();
        }
        if (new Set(choices.map(c => c.toLowerCase())).size !== choices.length) {
            throw new ValidationError();
        }
    }

    private isInvalidShortTextLength(value: string): boolean {
        return value.length < 1 || value.length > 40;
    }
}