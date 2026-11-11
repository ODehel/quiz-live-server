import { describe, expect, it } from "vitest";
import { readBcryptCost } from "./bcrypt-cost";

const RULE_MESSAGE = "BCRYPT_COST must be an integer between 4 and 31.";

describe("US-002/CA-6 - bcrypt cost", () => {
    it.each(["abc", "12.5", "-1", "+12", " 12", "12 ", "1e1", "0x10"])("refuses a cost written other than in digits only: %j", (raw) => {
        expect(() => readBcryptCost(raw)).toThrow(RULE_MESSAGE);
    });
    it.each(["3", "32", "0", "100"])("refuses a cost out of the range 4 to 31: %j", (raw) => {
        expect(() => readBcryptCost(raw)).toThrow(RULE_MESSAGE);
    });
    it.each([["4", 4], ["31", 31], ["10", 10], ["12", 12]])("accepts a cost of %j and reads it as %i", (raw, expected) => {
        expect(readBcryptCost(raw)).toBe(expected);
    });
    it("reads an empty cost as 12", () => {
        expect(readBcryptCost("")).toBe(12);
    });
    it("reads an absent cost as 12", () => {
        expect(readBcryptCost(undefined)).toBe(12);
    });
    it.each([["012", 12], ["004", 4], ["0031", 31]])("accepts leading zeros: %j is read as %i", (raw, expected) => {
        expect(readBcryptCost(raw)).toBe(expected);
    });
    it("does not repeat the refused value in the message", () => {
        expect(() => readBcryptCost("not-a-cost-value")).toThrow(/^(?!.*not-a-cost-value).*BCRYPT_COST.*$/);
    });
});
