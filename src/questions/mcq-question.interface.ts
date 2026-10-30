import { BaseQuestion } from "./base-question.interface";

export type McqQuestion = BaseQuestion & {
    type: "MCQ";
    choices: string[];
};
