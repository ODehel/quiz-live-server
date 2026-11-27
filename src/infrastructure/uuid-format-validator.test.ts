import { beforeEach, describe, expect, it } from "vitest";
import { UuidFormatValidator } from "./uuid-format-validator";

describe("US-005/CA-24 - validation of the uuid format, whatever its version", () => {
    let validator: UuidFormatValidator;
    beforeEach(() => {
        validator = new UuidFormatValidator();
    });
    it('should validate a well-formed uuid of any version', () => {
        expect(validator.validate("018e4f5a-0000-0000-0000-000000000000")).toBe(true);
    });
    it('should unvalidate a malformed id', () => {
        expect(validator.validate("not-a-valid-uuid")).toBe(false);
    });
    it.each([
        ["text before it", "x018e4f5a-0000-0000-0000-000000000000"],
        ["text after it", "018e4f5a-0000-0000-0000-000000000000x"]
    ])('should unvalidate a well-formed uuid with %s', (_name, value) => {
        expect(validator.validate(value)).toBe(false);
    });
});
