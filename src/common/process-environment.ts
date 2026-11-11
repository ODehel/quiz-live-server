import { Environment } from "./environment.interface";

export class ProcessEnvironment implements Environment {
    port: number;
    sqliteDbPath: string;
    maxRequestsPerMinute: number;

    constructor() {
        this.port = parseInt(process.env.PORT ?? "3000");
        this.sqliteDbPath = process.env.SQLITE_DB_PATH || "quiz.db";
        this.maxRequestsPerMinute = parseInt(process.env.MAX_REQUESTS_PER_MINUTE ?? "100");
    }

    seedPasswordFor(login: string): string | undefined {
        return process.env[`SEED_PASSWORD_${login.replace(/^quiz_/, "").toUpperCase()}`];
    }

    bcryptCost(): string | undefined {
        return process.env.BCRYPT_COST;
    }
}
