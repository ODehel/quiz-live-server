export interface CreateSpeedInput {
    type: "SPEED",
    theme_id: string;
    title: string;
    correct_answer: string;
    level: number;
    time_limit: number;
    points: number;
}