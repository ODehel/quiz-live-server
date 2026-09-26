import { Question } from "./question.interface";

export interface QuestionRepository {
    insert(question: Question): void;
    getByTitle(title: string): Question | undefined;
    getById(id: string): Question | undefined;
}
