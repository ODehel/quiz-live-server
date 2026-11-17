import { Environment } from "./environment.interface";
import { readDatabasePath } from "./read-database-path";

export class ProcessEnvironment implements Environment {
    sqliteDbPath: string;
    maxRequestsPerMinute: number;

    constructor() {
        this.sqliteDbPath = readDatabasePath(process.env.SQLITE_DB_PATH);
        this.maxRequestsPerMinute = parseInt(process.env.MAX_REQUESTS_PER_MINUTE ?? "100");
    }

    seedPasswordFor(login: string): string | undefined {
        return process.env[`SEED_PASSWORD_${login.replace(/^quiz_/, "").toUpperCase()}`];
    }

    bcryptCost(): string | undefined {
        return process.env.BCRYPT_COST;
    }
}
