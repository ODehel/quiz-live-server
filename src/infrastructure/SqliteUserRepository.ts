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
        const row = this.db.prepare("SELECT COUNT(USR_LOGIN) as count FROM T_USER_USR").get() as { count: number };
        return Promise.resolve(row.count);
    }
    insert(user: IUser): Promise<void> {
        const stmt = this.db.prepare("INSERT INTO T_USER_USR (USR_ID, USR_LOGIN, USR_HASH_PASSWORD, USR_ROLE) VALUES (?, ?, ?, ?)");
        stmt.run(user.id, user.username, user.password, user.role);
        return Promise.resolve();
    }
    retrieveByLogin(login: string): Promise<IUser | undefined> {
        const user = this.db.prepare("SELECT USR_ID as id, USR_LOGIN as username, USR_HASH_PASSWORD as password, USR_ROLE as role FROM T_USER_USR WHERE USR_LOGIN = ?").get(login) as IUser | undefined;
        return Promise.resolve(user);
    }

    private createTableIfNotExists() {
        this.db.prepare(`CREATE TABLE IF NOT EXISTS T_USER_USR (
            USR_ID TEXT NOT NULL PRIMARY KEY,
            USR_LOGIN TEXT NOT NULL UNIQUE,
            USR_HASH_PASSWORD TEXT NOT NULL,
            USR_ROLE SHORT NOT NULL
        )`).run();
    }
}