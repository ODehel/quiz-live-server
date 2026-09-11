import { Clock } from "../common/clock.interface";
import { UuidGenerator } from "../common/uuid-generator.interface";
import { CreateMcqInput } from "./create-mcq-input.interface";
import { CreateSpeedInput } from "./create-speed-input.interface";
import { QuestionRepository } from "./question-repository.interface";
import { McqQuestion } from "./mcq-question.interface";
import { SpeedQuestion } from "./speed-question.interface";

type CreateQuestionInput = CreateMcqInput | CreateSpeedInput;

export type Question = McqQuestion | SpeedQuestion;

export class DefaultQuestionService {
    constructor(private clock: Clock, private uuidGenerator: UuidGenerator, private questionRepository: QuestionRepository) {
    }

    createQuestion(input: CreateQuestionInput): Question {
        let question: Question;
        if (input.type === "MCQ") {
            question = {
                id: this.uuidGenerator.generate(),
                type: "MCQ",
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
        } else {
            question = {
                id: this.uuidGenerator.generate(),
                type: "SPEED",
                theme_id: input.theme_id,
                title: input.title,
                correct_answer: input.correct_answer,
                level: input.level,
                time_limit: input.time_limit,
                points: input.points,
                image_path: null,
                audio_path: null,
                created_at: this.clock.now().toISOString(),
                last_updated_at: null
            };
        }
        this.questionRepository.insert(question);

        return question;
    }
}