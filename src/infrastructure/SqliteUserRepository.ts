import { IUserRepository } from "../users/IUserRepository";
import { IUser } from "../users/IUser";
import Database, { Database as DatabaseType } from 'better-sqlite3'

export class SqliteUserRepository implements IUserRepository {
    private db: DatabaseType;
    constructor(databaseFilePath: string) {
        this.db = new Database(databaseFilePath);
        this.createTableIfNotExists();
    }
    count(): Promise<number> {
        const row = this.db.prepare("SELECT COUNT(USR_LOGIN) as count FROM T_USER_USR").get() as { count: number};
        return Promise.resolve(row.count);
    }
    insert(user: IUser): Promise<void> {
        const stmt = this.db.prepare("INSERT INTO T_USER_USR (USR_LOGIN, USR_HASH_PASSWORD, USR_ROLE) VALUES (?, ?, ?)");
        stmt.run(user.username, user.password, user.role);
        return Promise.resolve();
    }

    private createTableIfNotExists() {
        this.db.prepare(`CREATE TABLE IF NOT EXISTS T_USER_USR (
            USR_LOGIN TEXT NOT NULL PRIMARY KEY,
            USR_HASH_PASSWORD TEXT NOT NULL,
            USR_ROLE SHORT NOT NULL
        )`).run();
    }
}