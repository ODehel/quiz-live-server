import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ProcessEnvironment } from "./process-environment";

const seedPasswordVariables = [
    "SEED_PASSWORD_ADMIN",
    ...Array.from({ length: 10 }, (_, i) => `SEED_PASSWORD_BUZZER_${String(i + 1).padStart(2, "0")}`)
];

describe("environment variables test", () => {
    beforeEach(() => {
        process.env.PORT = "3000";
        process.env.SQLITE_DB_PATH = "./simple_path";
        process.env.JWT_SECRET = "aSecretTestKey";
        process.env.JWT_EXPIRATION = "400";
        process.env.MAX_REQUESTS_PER_MINUTE = "5";
    });
    it("should provide environment values", () => {
        const processEnvironment: ProcessEnvironment = new ProcessEnvironment();
        expect(processEnvironment.port).toBe(3000);
        expect(processEnvironment.sqliteDbPath).toBe("./simple_path");
        expect(processEnvironment.jwtSecretKey).toBe("aSecretTestKey");
        expect(processEnvironment.jwtExpirationTime).toBe(400);
        expect(processEnvironment.maxRequestsPerMinute).toBe(5);
    });
    it("should default the token lifetime to one hour", () => {
        delete process.env.JWT_EXPIRATION;
        const processEnvironment: ProcessEnvironment = new ProcessEnvironment();
        expect(processEnvironment.jwtExpirationTime).toBe(3600);
    });
    it("should ignore the former names of the token variables", () => {
        delete process.env.JWT_SECRET;
        delete process.env.JWT_EXPIRATION;
        process.env.JWT_SECRET_KEY = "aFormerSecretKey";
        process.env.JWT_EXPIRATION_TIME = "900";
        const processEnvironment: ProcessEnvironment = new ProcessEnvironment();
        expect(processEnvironment.jwtSecretKey).not.toBe("aFormerSecretKey");
        expect(processEnvironment.jwtExpirationTime).toBe(3600);
    });
    it("should read each seed password from its own variable", () => {
        seedPasswordVariables.forEach((variable) => { process.env[variable] = `value-of-${variable}`; });
        const processEnvironment: ProcessEnvironment = new ProcessEnvironment();
        expect(processEnvironment.seedPasswordFor("admin")).toBe("value-of-SEED_PASSWORD_ADMIN");
        for (let i = 1; i <= 10; i++) {
            const suffix = String(i).padStart(2, "0");
            expect(processEnvironment.seedPasswordFor(`quiz_buzzer_${suffix}`)).toBe(`value-of-SEED_PASSWORD_BUZZER_${suffix}`);
        }
    });
    it("should provide no seed password when its variable is not set", () => {
        const processEnvironment: ProcessEnvironment = new ProcessEnvironment();
        expect(processEnvironment.seedPasswordFor("admin")).toBeUndefined();
        expect(processEnvironment.seedPasswordFor("quiz_buzzer_01")).toBeUndefined();
    });
    it("should ignore the former names of the seed password variables", () => {
        process.env.ADMIN_PASSWORD = "aFormerAdminPassword";
        process.env.BUZZER_DEFAULT_PASSWORD = "aFormerBuzzerPassword";
        const processEnvironment: ProcessEnvironment = new ProcessEnvironment();
        expect(processEnvironment.seedPasswordFor("admin")).toBeUndefined();
        expect(processEnvironment.seedPasswordFor("quiz_buzzer_01")).toBeUndefined();
    });
    afterEach(() => {
        delete process.env.PORT;
        delete process.env.SQLITE_DB_PATH;
        delete process.env.BUZZER_DEFAULT_PASSWORD;
        delete process.env.ADMIN_PASSWORD;
        for (const variable of seedPasswordVariables) {
            delete process.env[variable];
        }
        delete process.env.JWT_SECRET;
        delete process.env.JWT_EXPIRATION;
        delete process.env.JWT_SECRET_KEY;
        delete process.env.JWT_EXPIRATION_TIME;
        delete process.env.MAX_REQUESTS_PER_MINUTE;
    });
});
