import { beforeEach, describe, expect, it } from "vitest";
import { JwtDecoder } from "./jwt-decoder";
import { JwtGenerator } from "./jwt-generator";
import { User } from "../users/user.interface";
import { UserRole } from "../users/user-role";
import { Token } from "./token.interface";
import jwt from "jsonwebtoken";

describe("US-004/CA-33 - Decode a valid token", () => {
    let generator: JwtGenerator;
    let user: User;
    let token: Token;
    beforeEach(() => {
        generator = new JwtGenerator("mySecretKey", 30);
    });
    it("should return a correct decoded token as PLAYER", () => {
        user = { id: "019db98c-6680-7848-a417-63e8624a4969", username: "QUIZ_PLAYER_01", password: "asimplepassword", role: UserRole.PLAYER };
        token = generator.generateToken(user);
        const decoder: JwtDecoder = new JwtDecoder();
        const decodedToken = decoder.decode(token.token);
        expect(decodedToken).not.toBeUndefined();
        expect(decodedToken?.role).toBe(UserRole.PLAYER);
    });
    it("should return a correct decoded token as ADMIN", () => {
        user = { id: "019db98c-6680-7848-a417-63e8624a4969", username: "QUIZ_PLAYER_01", password: "asimplepassword", role: UserRole.ADMIN };
        token = generator.generateToken(user);
        const decoder: JwtDecoder = new JwtDecoder();
        const decodedToken = decoder.decode(token.token);
        expect(decodedToken).not.toBeUndefined();
        expect(decodedToken?.role).toBe(UserRole.ADMIN);
    });
    it("should return undefined", () => {
        const decoder: JwtDecoder = new JwtDecoder();
        const decodedToken = decoder.decode("blabla");
        expect(decodedToken).toBeUndefined();
    });
    it.each([
        ["the former numeric admin role", { sub: "123", role: 0 }],
        ["the former numeric player role", { sub: "123", role: 1 }],
        ["an unknown label", { sub: "123", role: "superadmin" }],
        ["no role", { sub: "123" }]
    ])("should return undefined for a token carrying %s", (_description, payload) => {
        const token = jwt.sign(payload, "mySecretKey");
        const decoder: JwtDecoder = new JwtDecoder();
        expect(decoder.decode(token)).toBeUndefined();
    });
});
