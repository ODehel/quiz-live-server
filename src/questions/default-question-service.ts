import { Clock } from "../common/clock.interface";
import { UuidGenerator } from "../common/uuid-generator.interface";
import { CreateMcqInput } from "./create-question-input.interface";
import { QuestionRepository } from "./question-repository.interface";
import { McqQuestion } from "./question.interface";

export class DefaultQuestionService {
    constructor(private clock: Clock, private uuidGenerator: UuidGenerator, private questionRepository: QuestionRepository) {
    }

    createQuestion(input: CreateMcqInput): McqQuestion {
        const question: McqQuestion = {
            id: this.uuidGenerator.generate(),
            type: input.type,
            theme_id: input.theme_id,
            title: input.title,
            choices: input.choices,
            correct_answer: input.correct_answer,
            level: input.level,
            time_limit: input.time_limit,
            points: input.points,
            image_path: null,
            audio_path: null,
            created_at: this.clock.now().toISOString(),
            last_updated_at: null
        };
        this.questionRepository.insert(question);

        return question;
    }
}