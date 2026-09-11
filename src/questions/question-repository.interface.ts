import { Question } from "./question.interface";

export interface QuestionRepository {
    insert(question: Question): void;
}