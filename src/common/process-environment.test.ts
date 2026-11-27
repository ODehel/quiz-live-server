import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ProcessEnvironment } from "./process-environment";

const seedPasswordVariables = [
    "SEED_PASSWORD_ADMIN",
    ...Array.from({ length: 10 }, (_, i) => `SEED_PASSWORD_BUZZER_${String(i + 1).padStart(2, "0")}`)
];

describe("environment variables test", () => {
    beforeEach(() => {
        process.env.SQLITE_DB_PATH = "./simple_path";
    });
    it("should provide environment values", () => {
        const processEnvironment: ProcessEnvironment = new ProcessEnvironment();
        expect(processEnvironment.sqliteDbPath).toBe("./simple_path");
    });
    it("US-001/CA-10 and US-002/CA-8 should refuse SQLITE_DB_PATH defined but empty, instead of treating it as absent", () => {
        process.env.SQLITE_DB_PATH = "";
        expect(() => new ProcessEnvironment()).toThrow("SQLITE_DB_PATH cannot be empty or made only of whitespace.");
    });
    it("US-001/CA-10 and US-002/CA-8 should refuse SQLITE_DB_PATH made only of whitespace", () => {
        process.env.SQLITE_DB_PATH = " \t\r\n\u00A0";
        expect(() => new ProcessEnvironment()).toThrow("SQLITE_DB_PATH cannot be empty or made only of whitespace.");
    });
    it("US-001/CA-10 and US-002/CA-8 should provide the path without the whitespace around it", () => {
        process.env.SQLITE_DB_PATH = "\t ./simple_path \r\n";
        expect(new ProcessEnvironment().sqliteDbPath).toBe("./simple_path");
    });
    it("US-001/CA-10 and US-002/CA-8 should provide quiz.db when SQLITE_DB_PATH is not set", () => {
        delete process.env.SQLITE_DB_PATH;
        expect(new ProcessEnvironment().sqliteDbPath).toBe("quiz.db");
    });
    it("should not hold MAX_REQUESTS_PER_MINUTE, which only the hub start reads", () => {
        process.env.MAX_REQUESTS_PER_MINUTE = "5";
        expect(new ProcessEnvironment()).not.toHaveProperty("maxRequestsPerMinute");
    });
    it.each(["", "abc", "8080abc", "1.5", "1e3", "0", "-1", "+5", " 5", "5 ", "  \t", "2147483648", "5"])("US-002/CA-10 should not refuse the seed whatever MAX_REQUESTS_PER_MINUTE is: %j", (value) => {
        process.env.MAX_REQUESTS_PER_MINUTE = value;
        expect(() => new ProcessEnvironment()).not.toThrow();
    });
    it("US-002/CA-10 should provide the same path whatever MAX_REQUESTS_PER_MINUTE is", () => {
        process.env.MAX_REQUESTS_PER_MINUTE = "abc";
        expect(new ProcessEnvironment().sqliteDbPath).toBe("./simple_path");
    });
    it("US-001/CA-10 should report SQLITE_DB_PATH when it is empty, whatever MAX_REQUESTS_PER_MINUTE is", () => {
        process.env.MAX_REQUESTS_PER_MINUTE = "abc";
        process.env.SQLITE_DB_PATH = "";
        expect(() => new ProcessEnvironment()).toThrow(/^SQLITE_DB_PATH /);
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
    it("should drop the quiz_ prefix of a login only at its start", () => {
        process.env.SEED_PASSWORD_MY_QUIZ_ACCOUNT = "value-of-the-account";
        process.env.SEED_PASSWORD_XQUIZ_ACCOUNT = "value-of-the-other-account";
        const processEnvironment: ProcessEnvironment = new ProcessEnvironment();
        expect(processEnvironment.seedPasswordFor("my_quiz_account")).toBe("value-of-the-account");
        expect(processEnvironment.seedPasswordFor("xquiz_account")).toBe("value-of-the-other-account");
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
    it("US-002/CA-6 should provide BCRYPT_COST as written, without judging it", () => {
        process.env.BCRYPT_COST = "abc";
        const processEnvironment: ProcessEnvironment = new ProcessEnvironment();
        expect(processEnvironment.bcryptCost()).toBe("abc");
    });
    it("US-002/CA-6 should provide no BCRYPT_COST when the variable is not set", () => {
        expect(new ProcessEnvironment().bcryptCost()).toBeUndefined();
    });
    afterEach(() => {
        delete process.env.BCRYPT_COST;
        delete process.env.SQLITE_DB_PATH;
        delete process.env.BUZZER_DEFAULT_PASSWORD;
        delete process.env.ADMIN_PASSWORD;
        for (const variable of seedPasswordVariables) {
            delete process.env[variable];
        }
        delete process.env.SEED_PASSWORD_MY_QUIZ_ACCOUNT;
        delete process.env.SEED_PASSWORD_XQUIZ_ACCOUNT;
        delete process.env.JWT_SECRET;
        delete process.env.JWT_EXPIRATION;
        delete process.env.MAX_REQUESTS_PER_MINUTE;
    });
});
