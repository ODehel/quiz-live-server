import { describe, expect, it } from "vitest";
import { readPort } from "./read-port";

const refusal = "PORT must be an integer between 1 and 65535.";

describe("listening port", () => {
    it("US-001/CA-5 defaults to 3000 when PORT is absent", () => {
        expect(readPort({})).toBe(3000);
    });
    it("US-001/CA-5 reads the port written in PORT", () => {
        expect(readPort({ PORT: "8080" })).toBe(8080);
        expect(readPort({ PORT: "4321" })).toBe(4321);
    });
    it("US-001/CA-7 accepts the lowest port, 1", () => {
        expect(readPort({ PORT: "1" })).toBe(1);
    });
    it("US-001/CA-7 accepts the highest port, 65535", () => {
        expect(readPort({ PORT: "65535" })).toBe(65535);
    });
    it("US-001/CA-7 accepts leading zeros (decision #45)", () => {
        expect(readPort({ PORT: "08080" })).toBe(8080);
    });
    it("US-001/CA-7 refuses an empty PORT, which does not mean absent", () => {
        expect(() => readPort({ PORT: "" })).toThrow(refusal);
    });
    it("US-001/CA-7 refuses a PORT that is not a number", () => {
        expect(() => readPort({ PORT: "abc" })).toThrow(refusal);
    });
    it("US-001/CA-7 refuses a PORT followed by letters", () => {
        expect(() => readPort({ PORT: "8080abc" })).toThrow(refusal);
    });
    it("US-001/CA-7 refuses a decimal PORT", () => {
        expect(() => readPort({ PORT: "80.5" })).toThrow(refusal);
    });
    it("US-001/CA-7 refuses a PORT in exponential notation", () => {
        expect(() => readPort({ PORT: "1e3" })).toThrow(refusal);
    });
    it("US-001/CA-7 refuses PORT 0", () => {
        expect(() => readPort({ PORT: "0" })).toThrow(refusal);
    });
    it("US-001/CA-7 refuses PORT 00 written with zeros only", () => {
        expect(() => readPort({ PORT: "00" })).toThrow(refusal);
    });
    it("US-001/CA-7 refuses a negative PORT", () => {
        expect(() => readPort({ PORT: "-1" })).toThrow(refusal);
    });
    it("US-001/CA-7 refuses a PORT above 65535", () => {
        expect(() => readPort({ PORT: "65536" })).toThrow(refusal);
    });
    it("US-001/CA-7 refuses a PORT with a leading space", () => {
        expect(() => readPort({ PORT: " 8080" })).toThrow(refusal);
    });
    it("US-001/CA-7 refuses a PORT with a trailing space", () => {
        expect(() => readPort({ PORT: "8080 " })).toThrow(refusal);
    });
    it("US-001/CA-7 refuses a PORT with a plus sign", () => {
        expect(() => readPort({ PORT: "+8080" })).toThrow(refusal);
    });
    it("US-001/CA-7 refuses a PORT with a tab before the digits", () => {
        expect(() => readPort({ PORT: " \t8080" })).toThrow(refusal);
    });
    it("US-001/CA-7 refuses a PORT written in hexadecimal", () => {
        expect(() => readPort({ PORT: "0x1F90" })).toThrow(refusal);
    });
    it("US-001/CA-7 refuses a PORT written with non-ASCII digits", () => {
        expect(() => readPort({ PORT: "\u0668\u0660\u0668\u0660" })).toThrow(refusal);
        expect(() => readPort({ PORT: "\uFF18\uFF10\uFF18\uFF10" })).toThrow(refusal);
    });
    it("US-001/CA-7 refuses a PORT with a digit separator", () => {
        expect(() => readPort({ PORT: "8_080" })).toThrow(refusal);
    });
    it("US-001/CA-7 does not repeat the value of an invalid PORT in the message", () => {
        expect(() => readPort({ PORT: "secret-value" })).toThrow(/^(?!.*secret-value).*PORT.*$/);
        expect(() => readPort({ PORT: "99999" })).toThrow(/^(?!.*99999).*PORT.*$/);
    });
});
