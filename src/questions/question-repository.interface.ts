import { McqQuestion } from "./question.interface";

export interface QuestionRepository {
    insert(question: McqQuestion): void;
}