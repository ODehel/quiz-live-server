import { beforeEach, describe, expect, it } from "vitest";
import { Uuidv7Validator } from "./uuidv7-validator";

describe("US-004/CA-11 - validation of uuidV7", () => {
    let validator: Uuidv7Validator;
    beforeEach(() => {
        validator = new Uuidv7Validator();
    });
    it('should validate a uuidv7 with correct format', () => {
        const valid = validator.validate("019d92d2-e1f6-7d05-9803-3948dbc4c416");
        expect(valid).toBe(true);
    });
    it("should unvalidate an id with uncorrect format", () => {
        const valid = validator.validate("1");
        expect(valid).toBe(false);
    });
});