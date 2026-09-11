export interface SpeedQuestion {
    id: string;
    type: "SPEED";
    theme_id: string;
    title: string;
    correct_answer: string;
    level: number;
    time_limit: number;
    points: number;
    image_path: string | null;
    audio_path: string | null;
    created_at: string;
    last_updated_at: string | null;
}