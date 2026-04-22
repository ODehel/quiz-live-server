import { beforeEach, describe, vi, it, expect } from "vitest";
import jwt, { Jwt } from "jsonwebtoken";
import { JwtValidator } from "./jwt-validator";

describe("US-004/CA-32 - Valid token", () => {
    let validator: JwtValidator;
    beforeEach(() => {
        validator = new JwtValidator("asecretkey");
    });
    it("should return true to validation", () => {
        jwt.verify = vi.fn().mockImplementation(() => { return { } as Jwt });
        const validated = validator.validateToken("atoken");
        expect(validated).toBe(true);
    });
    it("should return false if verify throws an error", () => {
        jwt.verify = vi.fn().mockImplementation(() => { throw new Error(); });
        const validated = validator.validateToken("atoken");
        expect(validated).toBe(false);
    });
});