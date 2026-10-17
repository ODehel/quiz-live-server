import { Question } from "./question.interface";

export interface QuestionRepository {
    insert(question: Question): void;
    getByTitle(title: string): Question | undefined;
    getAll(page: number, limit: number): Question[];
    getById(id: string): Question | undefined;
    count(): number;
}
