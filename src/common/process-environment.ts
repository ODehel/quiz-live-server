import { Environment } from "./environment.interface";
import { readDatabasePath } from "./read-database-path";

export class ProcessEnvironment implements Environment {
    sqliteDbPath: string;

    // MAX_REQUESTS_PER_MINUTE is not read here: only the hub uses it (index.ts reads it), and the seed ignores it whatever its value (US-002/CA-10, decision #95).
    constructor() {
        this.sqliteDbPath = readDatabasePath(process.env.SQLITE_DB_PATH);
    }

    seedPasswordFor(login: string): string | undefined {
        return process.env[`SEED_PASSWORD_${login.replace(/^quiz_/, "").toUpperCase()}`];
    }

    bcryptCost(): string | undefined {
        return process.env.BCRYPT_COST;
    }
}
