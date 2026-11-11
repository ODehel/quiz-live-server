import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ProcessEnvironment } from "./process-environment";

describe("environment variables test", () => {
    beforeEach(() => {
        process.env.PORT = "3000";
        process.env.SQLITE_DB_PATH = "./simple_path";
        process.env.BUZZER_DEFAULT_PASSWORD = "UserPassword";
        process.env.ADMIN_PASSWORD = "AdminPassword";
        process.env.JWT_SECRET = "aSecretTestKey";
        process.env.JWT_EXPIRATION = "400";
        process.env.MAX_REQUESTS_PER_MINUTE = "5";
    });
    it("should provide environment values", () => {
        const processEnvironment: ProcessEnvironment = new ProcessEnvironment();
        expect(processEnvironment.port).toBe(3000);
        expect(processEnvironment.sqliteDbPath).toBe("./simple_path");
        expect(processEnvironment.playerPassword).toBe("UserPassword");
        expect(processEnvironment.adminPassword).toBe("AdminPassword");
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
    afterEach(() => {
        delete process.env.PORT;
        delete process.env.SQLITE_DB_PATH;
        delete process.env.BUZZER_DEFAULT_PASSWORD;
        delete process.env.ADMIN_PASSWORD;
        delete process.env.JWT_SECRET;
        delete process.env.JWT_EXPIRATION;
        delete process.env.JWT_SECRET_KEY;
        delete process.env.JWT_EXPIRATION_TIME;
        delete process.env.MAX_REQUESTS_PER_MINUTE;
    });
});
