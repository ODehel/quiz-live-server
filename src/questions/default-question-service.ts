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

        if (input.type === 'MCQ') {
            this.validateChoices(input.choices);
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
            correct_answer: input.correct_answer,
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
                ? { ...base, type: "MCQ", choices: input.choices }
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
        if (choices.length !== 4 || choices.some(c => c.length < 1 || c.length > 40)) {
            throw new ValidationError();
        }
    }
}