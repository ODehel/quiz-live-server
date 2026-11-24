import { Environment } from "./environment.interface";
import { readDatabasePath } from "./read-database-path";
import { readMaxRequestsPerMinute } from "./read-max-requests-per-minute";

export class ProcessEnvironment implements Environment {
    sqliteDbPath: string;
    maxRequestsPerMinute: number;

    // MAX_REQUESTS_PER_MINUTE is checked before SQLITE_DB_PATH: the order of US-003/CA-21 (decision #94) is JWT_*, PORT, MAX_REQUESTS_PER_MINUTE, then the database.
    constructor() {
        this.maxRequestsPerMinute = readMaxRequestsPerMinute(process.env);
        this.sqliteDbPath = readDatabasePath(process.env.SQLITE_DB_PATH);
    }

    seedPasswordFor(login: string): string | undefined {
        return process.env[`SEED_PASSWORD_${login.replace(/^quiz_/, "").toUpperCase()}`];
    }

    bcryptCost(): string | undefined {
        return process.env.BCRYPT_COST;
    }
}
