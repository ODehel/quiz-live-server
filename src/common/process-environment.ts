import { Environment } from "./environment.interface";

export class ProcessEnvironment implements Environment {
    port: number;
    sqliteDbPath: string;
    playerPassword: string;
    adminPassword: string;
    jwtSecretKey: string;
    jwtExpirationTime: number;
    maxRequestsPerMinute: number;

    constructor() {
        this.port = parseInt(process.env.PORT ?? "3000");
        this.sqliteDbPath = process.env.SQLITE_DB_PATH || "quiz.db";
        this.playerPassword = process.env.BUZZER_DEFAULT_PASSWORD || "player123";
        this.adminPassword = process.env.ADMIN_PASSWORD || "admin123";
        this.jwtSecretKey = process.env.JWT_SECRET_KEY || "MySecretKey";
        this.jwtExpirationTime = parseInt(process.env.JWT_EXPIRATION_TIME ?? "3600");
        this.maxRequestsPerMinute = parseInt(process.env.MAX_REQUESTS_PER_MINUTE ?? "100");
    }
}