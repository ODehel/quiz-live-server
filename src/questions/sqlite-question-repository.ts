import { QuestionRepository } from "./question-repository.interface";
import { Question } from "./question.interface";
import Database, { Database as DatabaseType } from 'better-sqlite3'

type QuestionRow = {
    id: string;
    type: string;
    theme_id: string;
    title: string;
    choices: string | null;
    correct_answer: string;
    level: number;
    time_limit: number;
    points: number;
    image_path: string | null;
    audio_path: string | null;
    created_at: string;
    last_updated_at: string | null;
};

export class SqliteQuestionRepository implements QuestionRepository {
    private db: DatabaseType;
    constructor(databaseFilePath: string) {
        this.db = new Database(databaseFilePath);
        this.createTableIfNotExists();
    }

    close(): void {
        this.db.close();
    }

    insert(question: Question): void {
        const choices = question.type === 'MCQ' ? JSON.stringify(question.choices) : null;
        const stmt = this.db.prepare(`INSERT INTO T_QUESTION_QST (QST_ID, QST_TYPE, QST_THEME_ID, QST_TITLE, QST_CHOICES,
            QST_CORRECT_ANSWER, QST_LEVEL, QST_TIME_LIMIT, QST_POINTS, QST_IMAGE_PATH, QST_AUDIO_PATH, QST_CREATED_AT, QST_LAST_UPDATED_AT)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        stmt.run(question.id, question.type, question.theme_id, question.title, choices, question.correct_answer, question.level, question.time_limit,
            question.points, question.image_path, question.audio_path, question.created_at, question.last_updated_at);
    }

    getByTitle(title: string): Question | undefined {
        const row = this.db.prepare(`SELECT QST_ID as id, QST_TYPE as type, QST_THEME_ID as theme_id, QST_TITLE as title, QST_CHOICES as choices, QST_CORRECT_ANSWER as correct_answer, QST_LEVEL as level,
            QST_TIME_LIMIT as time_limit, QST_POINTS as points, QST_IMAGE_PATH as image_path, QST_AUDIO_PATH as audio_path, QST_CREATED_AT as created_at, QST_LAST_UPDATED_AT as last_updated_at
            FROM T_QUESTION_QST
            WHERE QST_TITLE = ? COLLATE NOCASE`).get(title) as QuestionRow | undefined;

        if (row === undefined)
            return undefined;

        const base = {
            id: row.id,
            theme_id: row.theme_id,
            title: row.title,
            correct_answer: row.correct_answer,
            level: row.level,
            time_limit: row.time_limit,
            points: row.points,
            image_path: row.image_path,
            audio_path: row.audio_path,
            created_at: row.created_at,
            last_updated_at: row.last_updated_at
        };
        if (row.type === "MCQ")
            return { ...base, type: "MCQ", choices: JSON.parse(row.choices!) as string[] };

        return { ...base, type: "SPEED" };
    }

    private createTableIfNotExists() {
        this.db.prepare(`CREATE TABLE IF NOT EXISTS T_QUESTION_QST
(
    QST_ID              TEXT PRIMARY KEY,
    QST_TYPE            TEXT NOT NULL,
    QST_THEME_ID        TEXT NOT NULL REFERENCES T_THEME_THM (THM_ID),
    QST_TITLE           TEXT NOT NULL UNIQUE COLLATE NOCASE,
    QST_CHOICES         TEXT DEFAULT NULL,
    QST_CORRECT_ANSWER  TEXT NOT NULL,
    QST_LEVEL           INTEGER NOT NULL,
    QST_TIME_LIMIT      INTEGER NOT NULL,
    QST_POINTS          INTEGER NOT NULL,
    QST_IMAGE_PATH      TEXT DEFAULT NULL,
    QST_AUDIO_PATH      TEXT DEFAULT NULL,
    QST_CREATED_AT      TEXT NOT NULL,
    QST_LAST_UPDATED_AT TEXT DEFAULT NULL
);`).run();
    }
}
