import { describe, expect, it } from "vitest";
import { readDigitsOnlyInteger } from "./read-digits-only-integer";

describe("read an integer written in digits only", () => {
    it.each([["0", 0], ["7", 7], ["12", 12], ["3600", 3600], ["65535", 65535]])("reads %j as %i", (raw, expected) => {
        expect(readDigitsOnlyInteger(raw)).toBe(expected);
    });
    it.each([["012", 12], ["004", 4], ["0000", 0]])("reads leading zeros: %j as %i", (raw, expected) => {
        expect(readDigitsOnlyInteger(raw)).toBe(expected);
    });
    it("refuses an empty string", () => {
        expect(readDigitsOnlyInteger("")).toBeUndefined();
    });
    it.each(["abc", "12abc", "abc12", "1a2"])("refuses a value that holds a non-digit: %j", (raw) => {
        expect(readDigitsOnlyInteger(raw)).toBeUndefined();
    });
    it.each(["-1", "+1", "-0"])("refuses a sign: %j", (raw) => {
        expect(readDigitsOnlyInteger(raw)).toBeUndefined();
    });
    it.each(["1.5", "1.", ".5", "1,5"])("refuses a decimal: %j", (raw) => {
        expect(readDigitsOnlyInteger(raw)).toBeUndefined();
    });
    it.each(["1e3", "1E3", "0x10", "0b1", "Infinity"])("refuses a notation other than digits: %j", (raw) => {
        expect(readDigitsOnlyInteger(raw)).toBeUndefined();
    });
    it.each([" 12", "12 ", " 12 ", "12\n", "\t12", "1 2"])("refuses whitespace: %j", (raw) => {
        expect(readDigitsOnlyInteger(raw)).toBeUndefined();
    });
    it.each(["١٢", "１２"])("refuses digits of another script: %j", (raw) => {
        expect(readDigitsOnlyInteger(raw)).toBeUndefined();
    });
});
