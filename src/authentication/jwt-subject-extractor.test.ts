import { beforeEach, describe, expect, it } from "vitest";
import { JwtSubjectExtractor } from "./jwt-subject-extractor"
import { JwtGenerator } from "./jwt-generator";
import { Token } from "./token.interface";
import { User } from "../users/user.interface";

describe("Sub extractor", () => {
    let generator: JwtGenerator;
    let user: User;
    let token: Token;
    beforeEach(() => {
        generator = new JwtGenerator("mySecretKey", 30);
    });
    it("should extract the id of the user from the token", () => {
        user = { id: "019db98c-6680-7848-a417-63e8624a4969", username: "QUIZ_PLAYER_01", password: "asimplepassword" } as User;
        token = generator.generateToken(user);
        const decoder: JwtSubjectExtractor = new JwtSubjectExtractor();
        expect(decoder.extract(token.token)).toBe(user.id)
    });
});