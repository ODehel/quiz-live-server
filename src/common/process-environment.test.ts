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
        process.env.MAX_REQUESTS_PER_MINUTE = "5";
    });
    it("should provide environment values", () => {
        const processEnvironment: ProcessEnvironment = new ProcessEnvironment();
        expect(processEnvironment.port).toBe(3000);
        expect(processEnvironment.sqliteDbPath).toBe("./simple_path");
        expect(processEnvironment.maxRequestsPerMinute).toBe(5);
    });
    it("should not hold the JWT settings, which only the hub start reads", () => {
        const processEnvironment: ProcessEnvironment = new ProcessEnvironment();
        expect(processEnvironment).not.toHaveProperty("jwtSecretKey");
        expect(processEnvironment).not.toHaveProperty("jwtExpirationTime");
    });
    it("US-003/CA-19 should not refuse the seed when the JWT secret is missing or the lifetime is invalid", () => {
        delete process.env.JWT_SECRET;
        process.env.JWT_EXPIRATION = "abc";
        expect(() => new ProcessEnvironment()).not.toThrow();
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
        delete process.env.MAX_REQUESTS_PER_MINUTE;
    });
});
