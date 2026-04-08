import { beforeEach, describe, expect, it } from "vitest";
import { OwaspPasswordValidator } from "./owasp-password-validator";

describe("PasswordValidator", () => {
    let passwordValidator: OwaspPasswordValidator;
    beforeEach(() => {
            passwordValidator = new OwaspPasswordValidator();
    });
    it("should not validate passwords that are too short", () => {
        expect(passwordValidator.validate("abcdefghijk")).toBe(false);
    });
    it("should validate passwords that are long enough", () => {
        expect(passwordValidator.validate("abcdefghijkl")).toBe(true);
    });
    it("should validate passwords that are long enough and contain special characters", () => {
        expect(passwordValidator.validate("unmotdepassesuffisammentlongmaispasbeaucouppluslongquecafautquecelapasse")).toBe(true);
    });
    it("should not validate passwords that are too long", () => {
        expect(passwordValidator.validate("unmotdepassesuffisammentlongmaispaslegerementpluslongquecacanepasserapas!")).toBe(false);
    });
    it("should validate passwords that are long enough and contain special characters and numbers", () => {
        expect(passwordValidator.validate("withspecialchars!@#")).toBe(true);
    });
    it("should not validate passwords that contain accented characters", () => {
        expect(passwordValidator.validate("UnMotDePasseQuiNePasseraPasCarIlContientDesCaractèresAccentués")).toBe(false);
    });
});