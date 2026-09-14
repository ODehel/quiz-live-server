import { CreateMcqInput } from "./create-mcq-input.interface";
import { CreateSpeedInput } from "./create-speed-input.interface";
import { Question } from "./question.interface";

export interface QuestionService {
    createQuestion(input: CreateMcqInput | CreateSpeedInput): Question;
}