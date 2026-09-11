import { Question } from "./default-question-service";

export interface QuestionRepository {
    insert(question: Question): void;
}