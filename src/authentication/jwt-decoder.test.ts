import { beforeEach, describe, expect, it } from "vitest";
import { JwtDecoder } from "./jwt-decoder";
import { JwtGenerator } from "./jwt-generator";
import { User } from "../users/user.interface";
import { UserRole } from "../users/user-role";
import { Token } from "./token.interface";

describe("US-004/CA-33 - Decode a valid token", () => {
    let generator: JwtGenerator;
    let user: User;
    let token: Token;
    beforeEach(() => {
        generator = new JwtGenerator("mySecretKey", 30);
    });
    it("should return a correct decoded token as PLAYER", () => {
        user = { id: "019db98c-6680-7848-a417-63e8624a4969", username: "QUIZ_PLAYER_01", password: "asimplepassword", role: UserRole.PLAYER } as User;
        token = generator.generateToken(user);
        const decoder: JwtDecoder = new JwtDecoder();
        const decodedToken = decoder.decode(token.token);
        expect(decodedToken).not.toBeUndefined();
        expect(decodedToken?.role).toBe(UserRole.PLAYER);
    });
    it("should return a correct decoded token as ADMIN", () => {
        user = { id: "019db98c-6680-7848-a417-63e8624a4969", username: "QUIZ_PLAYER_01", password: "asimplepassword", role: UserRole.ADMIN } as User;
        token = generator.generateToken(user);
        const decoder: JwtDecoder = new JwtDecoder();
        const decodedToken = decoder.decode(token.token);
        expect(decodedToken).not.toBeUndefined();
        expect(decodedToken?.role).toBe(UserRole.ADMIN);
    });
});