import { ThemeRepository } from "./theme-repository.interface";
import { Theme } from "./theme.interface";
import Database, { Database as DatabaseType } from 'better-sqlite3'

export class SqliteThemeRepository implements ThemeRepository {
    private db: DatabaseType;

    constructor(databaseFilePath: string) {
        this.db = new Database(databaseFilePath);
        this.createTableIfNotExists();
    }
    getAll(page: number, limit: number): Theme[] {
        const themes = this.db.prepare("SELECT THM_ID as id, THM_NAME as name, THM_CREATED_AT as created_at, THM_LAST_UPDATED_AT as last_updated_at FROM T_THEME_THM ORDER BY THM_CREATED_AT DESC LIMIT ? OFFSET ?").all(limit, (page - 1) * limit) as Theme[];
        return themes;
    }

    getById(id: string): Theme | undefined {
        const theme = this.db.prepare("SELECT THM_ID as id, THM_NAME as name, THM_CREATED_AT as created_at, THM_LAST_UPDATED_AT as last_updated_at FROM T_THEME_THM WHERE THM_ID = ?").get(id) as Theme | undefined;
        return theme;
    }

    count(): number {
        const row = this.db.prepare("SELECT COUNT(THM_ID) as count FROM T_THEME_THM").get() as { count: number };
        return row.count;
    }

    insert(theme: Theme): void {
        const stmt = this.db.prepare("INSERT INTO T_THEME_THM (THM_ID, THM_NAME, THM_CREATED_AT, THM_LAST_UPDATED_AT) VALUES (?, ?, ?, ?)");
        stmt.run(theme.id, theme.name, theme.created_at, theme.last_updated_at);
    }

    update(theme: Theme): void {
        const statement = this.db.prepare("UPDATE T_THEME_THM SET THM_NAME = ?, THM_LAST_UPDATED_AT = ? WHERE THM_ID = ?");
        statement.run(theme.name, theme.last_updated_at, theme.id);
    }
    
    getByName(name: string): Theme | undefined {
        const theme = this.db.prepare("SELECT THM_ID as id, THM_NAME as name, THM_CREATED_AT as created_at, THM_LAST_UPDATED_AT as last_updated_at FROM T_THEME_THM WHERE THM_NAME = ? COLLATE NOCASE").get(name) as Theme | undefined;
        return theme;
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