export interface CreateMcqInput {
    type: "MCQ";
    theme_id: string;
    title: string;
    choices: string[];
    correct_answer: string;
    level: number;
    time_limit: number;
    points: number;
}
