import { beforeEach, describe, vi, it, expect } from "vitest";
import jwt, { Jwt } from "jsonwebtoken";
import { JwtValidator } from "./jwt-validator";

describe("JWT validator", () => {
    let validator: JwtValidator;
    beforeEach(() => {
        validator = new JwtValidator("asecretkey");
    });
    it("should return true to validation", () => {
        jwt.verify = vi.fn().mockImplementation(() => { return {} as Jwt });
        const validated = validator.validateToken("atoken");
        expect(validated).toBe(true);
    });
    it("should return false if verify throws an error", () => {
        jwt.verify = vi.fn().mockImplementation(() => { throw new Error(); });
        const validated = validator.validateToken("atoken");
        expect(validated).toBe(false);
    });
    it("reports an invalid token as invalid", () => {
        jwt.verify = vi.fn().mockImplementation(() => { throw new Error(); });
        expect(validator.inspectToken("atoken")).toEqual({ valid: false, reason: "invalid" });
    });
    it("reports an expired token as expired", () => {
        jwt.verify = vi.fn().mockImplementation(() => { throw new jwt.TokenExpiredError("jwt expired", new Date()); });
        expect(validator.inspectToken("atoken")).toEqual({ valid: false, reason: "expired" });
    });
});