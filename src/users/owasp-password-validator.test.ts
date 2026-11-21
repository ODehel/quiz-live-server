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
    it.each([12, 13, 72])("should not validate a password made only of %i spaces", (length) => {
        expect(passwordValidator.validate(" ".repeat(length))).toBe(false);
    });
    it.each([
        ["a space at the start", " abcdefghijk"],
        ["a space at the end", "abcdefghijk "],
        ["a space inside", "abcdef ghijk"],
        ["eleven spaces and one other printable character", "           a"],
        ["eleven spaces and a tilde", "           ~"],
        ["one character followed by eleven spaces", "a           "]
    ])("should validate a password of 12 characters with %s", (_label, password) => {
        expect(passwordValidator.validate(password)).toBe(true);
    });
    it.each([
        ["U+007F (DEL), just above U+007E, at the start", "\u007Fabcdefghijk"],
        ["U+007F (DEL), just above U+007E, inside", "abcdef\u007Fghijk"],
        ["U+007F (DEL), just above U+007E, at the end", "abcdefghijk\u007F"],
        ["U+001F (unit separator), just below U+0020, at the start", "\u001Fabcdefghijk"],
        ["U+001F (unit separator), just below U+0020, inside", "abcdef\u001Fghijk"],
        ["U+001F (unit separator), just below U+0020, at the end", "abcdefghijk\u001F"],
        ["eleven spaces and U+007F", "           \u007F"],
        ["eleven spaces and U+001F", "           \u001F"]
    ])("should not validate a password of 12 characters with %s", (_label, password) => {
        expect(password).toHaveLength(12);
        expect(passwordValidator.validate(password)).toBe(false);
    });
    it("should not validate a long enough password made of U+007F or U+001F only", () => {
        expect(passwordValidator.validate("\u007F".repeat(12))).toBe(false);
        expect(passwordValidator.validate("\u001F".repeat(12))).toBe(false);
    });
    it("should still not validate a password made of too few spaces", () => {
        expect(passwordValidator.validate(" ".repeat(11))).toBe(false);
    });
});
