import { describe, expect, it } from "vitest";
import { readJwtSettings } from "./jwt-settings";

const validSecret = "a-secret-of-forty-characters-for-tests";

describe("JWT settings", () => {
    it("US-003/CA-19 refuses an absent secret", () => {
        expect(() => readJwtSettings({})).toThrow("JWT_SECRET is required and must contain at least 32 characters.");
    });
    it("US-003/CA-19 refuses an empty secret", () => {
        expect(() => readJwtSettings({ JWT_SECRET: "" })).toThrow("JWT_SECRET is required and must contain at least 32 characters.");
    });
    it("US-003/CA-19 refuses a secret of 31 characters", () => {
        expect(() => readJwtSettings({ JWT_SECRET: "a".repeat(31) })).toThrow("JWT_SECRET is required and must contain at least 32 characters.");
    });
    it("US-003/CA-19 accepts a secret of exactly 32 characters, counted as is", () => {
        const secret = " ".repeat(32);
        expect(readJwtSettings({ JWT_SECRET: secret }).secret).toBe(secret);
    });
    it("US-003/CA-19 does not repeat the value of a too short secret in the message", () => {
        const tooShort = "short-secret-value";
        expect(() => readJwtSettings({ JWT_SECRET: tooShort })).toThrow(/^(?!.*short-secret-value).*JWT_SECRET.*$/);
    });
    it("US-003/CA-4 reads the token lifetime from JWT_EXPIRATION, in seconds", () => {
        expect(readJwtSettings({ JWT_SECRET: validSecret, JWT_EXPIRATION: "900" }).expiration).toBe(900);
    });
    it("US-003/CA-4 defaults the token lifetime to 3600 seconds when JWT_EXPIRATION is absent", () => {
        expect(readJwtSettings({ JWT_SECRET: validSecret }).expiration).toBe(3600);
    });
    it("US-003/CA-4 defaults the token lifetime to 3600 seconds when JWT_EXPIRATION is empty", () => {
        expect(readJwtSettings({ JWT_SECRET: validSecret, JWT_EXPIRATION: "" }).expiration).toBe(3600);
    });
    it("US-003/CA-20 refuses a JWT_EXPIRATION that is not a number", () => {
        expect(() => readJwtSettings({ JWT_SECRET: validSecret, JWT_EXPIRATION: "abc" })).toThrow("JWT_EXPIRATION must be a strictly positive integer, in seconds.");
    });
    it("US-003/CA-20 refuses a decimal JWT_EXPIRATION", () => {
        expect(() => readJwtSettings({ JWT_SECRET: validSecret, JWT_EXPIRATION: "1.5" })).toThrow("JWT_EXPIRATION must be a strictly positive integer, in seconds.");
    });
    it("US-003/CA-20 refuses a zero JWT_EXPIRATION", () => {
        expect(() => readJwtSettings({ JWT_SECRET: validSecret, JWT_EXPIRATION: "0" })).toThrow("JWT_EXPIRATION must be a strictly positive integer, in seconds.");
    });
    it("US-003/CA-20 refuses a JWT_EXPIRATION in exponential notation", () => {
        expect(() => readJwtSettings({ JWT_SECRET: validSecret, JWT_EXPIRATION: "1e3" })).toThrow("JWT_EXPIRATION must be a strictly positive integer, in seconds.");
    });
    it.each(["3600s", "-5", " 3600", "3600 ", "+3600", "1,5", "3600\n"])("US-003/CA-20 refuses the JWT_EXPIRATION %j", (value) => {
        expect(() => readJwtSettings({ JWT_SECRET: validSecret, JWT_EXPIRATION: value })).toThrow("JWT_EXPIRATION must be a strictly positive integer, in seconds.");
    });
    it("US-003/CA-20 does not repeat the value of an invalid JWT_EXPIRATION in the message", () => {
        expect(() => readJwtSettings({ JWT_SECRET: validSecret, JWT_EXPIRATION: "3600s" })).toThrow(/^(?!.*3600s).*JWT_EXPIRATION.*$/);
    });
    it("US-003/CA-19 reports the secret before the expiration when both are invalid", () => {
        expect(() => readJwtSettings({ JWT_EXPIRATION: "abc" })).toThrow(/JWT_SECRET/);
    });
    it("US-003/CA-2 ignores the former name JWT_SECRET_KEY of the secret", () => {
        expect(() => readJwtSettings({ JWT_SECRET_KEY: validSecret })).toThrow(/JWT_SECRET/);
    });
    it("US-003/CA-4 ignores the former name JWT_EXPIRATION_TIME of the lifetime", () => {
        expect(readJwtSettings({ JWT_SECRET: validSecret, JWT_EXPIRATION_TIME: "900" }).expiration).toBe(3600);
    });
});
