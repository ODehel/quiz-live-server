import { beforeEach, describe, expect, it } from "vitest";
import { JwtExpirationExtractor } from "./jwt-expiration-extractor";
import { JwtGenerator } from "./jwt-generator";
import { Token } from "./token.interface";
import { User } from "../users/user.interface";
import jwt from "jsonwebtoken";

describe("Expiration extractor", () => {
    let generator: JwtGenerator;
    let user: User;
    let token: Token;
    beforeEach(() => {
        generator = new JwtGenerator("mySecretKey", 3600);
    });
    it("should extract the expiration date of the token", () => {
        user = { id: "019db98c-6680-7848-a417-63e8624a4969", username: "QUIZ_PLAYER_01", password: "asimplepassword" } as User;
        token = generator.generateToken(user);
        const decoded = jwt.verify(token.token, "mySecretKey") as jwt.JwtPayload;
        const extractor = new JwtExpirationExtractor();
        expect(extractor.extract(token.token)).toBe(decoded.exp);
    });
});