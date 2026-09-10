export interface McqQuestion {
    id: string;
    type: "MCQ";
    theme_id: string;
    title: string;
    choices: string[];
    correct_answer: string;
    level: number;
    time_limit: number;
    points: number;
    image_path: string | null;
    audio_path: string | null;
    created_at: string;
    last_updated_at: string | null;
}