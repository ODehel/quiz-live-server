import { UserRepository } from "./user-repository.interface";
import { User } from "./user.interface";
import { fromRoleLabel, toRoleLabel } from "./role-label";
import { Database } from 'better-sqlite3'

type StoredUser = Omit<User, "role"> & { role: string };

function toUser(row: StoredUser | undefined): User | undefined {
    if (row === undefined) {
        return undefined;
    }
    return { ...row, role: fromRoleLabel(row.role)! };
}

export class SqliteUserRepository implements UserRepository {
    private db: Database;

    constructor(db: Database) {
        this.db = db;
        this.createTableIfNotExists();
    }

    count(): Promise<number> {
        const row = this.db.prepare("SELECT COUNT(USR_LOGIN) as count FROM T_USER_USR").get() as { count: number };
        return Promise.resolve(row.count);
    }
    insert(user: User): Promise<void> {
        const stmt = this.db.prepare("INSERT INTO T_USER_USR (USR_ID, USR_LOGIN, USR_HASH_PASSWORD, USR_ROLE) VALUES (?, ?, ?, ?)");
        stmt.run(user.id, user.username, user.password, toRoleLabel(user.role));
        return Promise.resolve();
    }
    // One transaction, whose write lock is taken at its start (immediate): the count and the insertions are a single step for the other connections,
    // so an instance that waits for the lock reads the accounts of the one that wrote first instead of failing on a unique constraint at its first insert.
    // A process killed before the commit leaves no account: SQLite rolls the transaction back when the file is next opened.
    insertAllIfEmpty(users: User[]): Promise<boolean> {
        const insertAll = this.db.transaction((rows: User[]): boolean => {
            const { count } = this.db.prepare("SELECT COUNT(USR_LOGIN) as count FROM T_USER_USR").get() as { count: number };
            if (count !== 0) {
                return false;
            }
            const stmt = this.db.prepare("INSERT INTO T_USER_USR (USR_ID, USR_LOGIN, USR_HASH_PASSWORD, USR_ROLE) VALUES (?, ?, ?, ?)");
            for (const row of rows) {
                stmt.run(row.id, row.username, row.password, toRoleLabel(row.role));
            }
            return true;
        });
        return Promise.resolve().then(() => insertAll.immediate(users));
    }
    retrieveByLogin(login: string): Promise<User | undefined> {
        const row = this.db.prepare("SELECT USR_ID as id, USR_LOGIN as username, USR_HASH_PASSWORD as password, USR_ROLE as role FROM T_USER_USR WHERE USR_LOGIN = ?").get(login) as StoredUser | undefined;
        return Promise.resolve(toUser(row));
    }

    retrieveById(id: string): Promise<User | undefined> {
        const row = this.db.prepare("SELECT USR_ID as id, USR_LOGIN as username, USR_HASH_PASSWORD as password, USR_ROLE as role FROM T_USER_USR WHERE USR_ID = ?").get(id) as StoredUser | undefined;
        return Promise.resolve(toUser(row));
    }

    private createTableIfNotExists() {
        this.db.prepare(`CREATE TABLE IF NOT EXISTS T_USER_USR (
            USR_ID TEXT NOT NULL PRIMARY KEY,
            USR_LOGIN TEXT NOT NULL UNIQUE,
            USR_HASH_PASSWORD TEXT NOT NULL,
            USR_ROLE TEXT NOT NULL DEFAULT 'buzzer' CHECK (USR_ROLE IN ('admin', 'buzzer'))
        )`).run();
    }
}
