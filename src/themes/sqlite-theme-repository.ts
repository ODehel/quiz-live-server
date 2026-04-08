import { ThemeRepository } from "./theme-repository.interface";
import { Theme } from "./theme.interface";
import Database, { Database as DatabaseType } from 'better-sqlite3'

export class SqliteThemeRepository implements ThemeRepository {
    private db: DatabaseType;

    constructor(databaseFilePath: string) {
        this.db = new Database(databaseFilePath);
        this.createTableIfNotExists();
    }

    getById(id: string): Promise<Theme | undefined> {
        const theme = this.db.prepare("SELECT THM_ID as id, THM_NAME as name, THM_CREATED_AT as created_at, THM_LAST_UPDATED_AT as last_updated_at FROM T_THEME_THM WHERE THM_ID = ?").get(id) as Theme | undefined;
        return Promise.resolve(theme);
    }

    count(): Promise<number> {
        const row = this.db.prepare("SELECT COUNT(THM_ID) as count FROM T_THEME_THM").get() as { count: number };
        return Promise.resolve(row.count);
    }

    insert(theme: Theme): Promise<void> {
        const stmt = this.db.prepare("INSERT INTO T_THEME_THM (THM_ID, THM_NAME, THM_CREATED_AT, THM_LAST_UPDATED_AT) VALUES (?, ?, ?, ?)");
        stmt.run(theme.id, theme.name, theme.created_at, theme.last_updated_at);
        return Promise.resolve();
    }

    private createTableIfNotExists() {
        this.db.prepare(`CREATE TABLE IF NOT EXISTS T_THEME_THM (
            THM_ID TEXT NOT NULL PRIMARY KEY,
            THM_NAME TEXT NOT NULL,
            THM_CREATED_AT TEXT NOT NULL,
            THM_LAST_UPDATED_AT TEXT
        )`).run();
    }
}