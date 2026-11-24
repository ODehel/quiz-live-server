import { describe, expect, it } from "vitest";
import { readMaxRequestsPerMinute } from "./read-max-requests-per-minute";

const refusal = "MAX_REQUESTS_PER_MINUTE must be an integer between 1 and 2147483647, written with digits only.";

describe("requests per minute ceiling", () => {
    it("US-003/CA-13 defaults to 100 when MAX_REQUESTS_PER_MINUTE is absent", () => {
        expect(readMaxRequestsPerMinute({})).toBe(100);
    });
    it("US-003/CA-13 reads the ceiling written in MAX_REQUESTS_PER_MINUTE", () => {
        expect(readMaxRequestsPerMinute({ MAX_REQUESTS_PER_MINUTE: "3" })).toBe(3);
        expect(readMaxRequestsPerMinute({ MAX_REQUESTS_PER_MINUTE: "250" })).toBe(250);
    });
    it("US-003/CA-21 accepts the lowest ceiling, 1", () => {
        expect(readMaxRequestsPerMinute({ MAX_REQUESTS_PER_MINUTE: "1" })).toBe(1);
    });
    it("US-003/CA-21 accepts the highest ceiling, 2147483647", () => {
        expect(readMaxRequestsPerMinute({ MAX_REQUESTS_PER_MINUTE: "2147483647" })).toBe(2147483647);
    });
    it("US-003/CA-21 accepts leading zeros: 0100 is 100", () => {
        expect(readMaxRequestsPerMinute({ MAX_REQUESTS_PER_MINUTE: "0100" })).toBe(100);
    });
    it("US-003/CA-21 refuses an empty MAX_REQUESTS_PER_MINUTE, which does not mean absent", () => {
        expect(() => readMaxRequestsPerMinute({ MAX_REQUESTS_PER_MINUTE: "" })).toThrow(refusal);
    });
    it("US-003/CA-21 refuses a value that is not a number", () => {
        expect(() => readMaxRequestsPerMinute({ MAX_REQUESTS_PER_MINUTE: "abc" })).toThrow(refusal);
    });
    it("US-003/CA-21 refuses a number followed by letters", () => {
        expect(() => readMaxRequestsPerMinute({ MAX_REQUESTS_PER_MINUTE: "8080abc" })).toThrow(refusal);
    });
    it("US-003/CA-21 refuses a decimal", () => {
        expect(() => readMaxRequestsPerMinute({ MAX_REQUESTS_PER_MINUTE: "1.5" })).toThrow(refusal);
    });
    it("US-003/CA-21 refuses exponential notation", () => {
        expect(() => readMaxRequestsPerMinute({ MAX_REQUESTS_PER_MINUTE: "1e3" })).toThrow(refusal);
    });
    it("US-003/CA-21 refuses 0", () => {
        expect(() => readMaxRequestsPerMinute({ MAX_REQUESTS_PER_MINUTE: "0" })).toThrow(refusal);
    });
    it("US-003/CA-21 refuses 00, written with zeros only", () => {
        expect(() => readMaxRequestsPerMinute({ MAX_REQUESTS_PER_MINUTE: "00" })).toThrow(refusal);
    });
    it("US-003/CA-21 refuses a negative value", () => {
        expect(() => readMaxRequestsPerMinute({ MAX_REQUESTS_PER_MINUTE: "-1" })).toThrow(refusal);
    });
    it("US-003/CA-21 refuses a plus sign", () => {
        expect(() => readMaxRequestsPerMinute({ MAX_REQUESTS_PER_MINUTE: "+5" })).toThrow(refusal);
    });
    it("US-003/CA-21 refuses a leading space", () => {
        expect(() => readMaxRequestsPerMinute({ MAX_REQUESTS_PER_MINUTE: " 5" })).toThrow(refusal);
    });
    it("US-003/CA-21 refuses a trailing space", () => {
        expect(() => readMaxRequestsPerMinute({ MAX_REQUESTS_PER_MINUTE: "5 " })).toThrow(refusal);
    });
    it("US-003/CA-21 refuses a value made only of whitespace", () => {
        expect(() => readMaxRequestsPerMinute({ MAX_REQUESTS_PER_MINUTE: "   " })).toThrow(refusal);
        expect(() => readMaxRequestsPerMinute({ MAX_REQUESTS_PER_MINUTE: " \t" })).toThrow(refusal);
    });
    it("US-003/CA-21 refuses a ceiling above 2147483647", () => {
        expect(() => readMaxRequestsPerMinute({ MAX_REQUESTS_PER_MINUTE: "2147483648" })).toThrow(refusal);
    });
    it("US-003/CA-21 refuses a very long run of digits", () => {
        expect(() => readMaxRequestsPerMinute({ MAX_REQUESTS_PER_MINUTE: "9".repeat(400) })).toThrow(refusal);
    });
    it("US-003/CA-21 refuses a value written in hexadecimal", () => {
        expect(() => readMaxRequestsPerMinute({ MAX_REQUESTS_PER_MINUTE: "0x10" })).toThrow(refusal);
    });
    it("US-003/CA-21 refuses a value written with non-ASCII digits", () => {
        expect(() => readMaxRequestsPerMinute({ MAX_REQUESTS_PER_MINUTE: "٥" })).toThrow(refusal);
        expect(() => readMaxRequestsPerMinute({ MAX_REQUESTS_PER_MINUTE: "５" })).toThrow(refusal);
    });
    it("US-003/CA-21 refuses a digit separator", () => {
        expect(() => readMaxRequestsPerMinute({ MAX_REQUESTS_PER_MINUTE: "1_000" })).toThrow(refusal);
        expect(() => readMaxRequestsPerMinute({ MAX_REQUESTS_PER_MINUTE: "1,000" })).toThrow(refusal);
    });
    it("US-003/CA-21 does not repeat the value of an invalid MAX_REQUESTS_PER_MINUTE in the message", () => {
        expect(() => readMaxRequestsPerMinute({ MAX_REQUESTS_PER_MINUTE: "secret-value" })).toThrow(/^(?!.*secret-value).*MAX_REQUESTS_PER_MINUTE.*$/);
        expect(() => readMaxRequestsPerMinute({ MAX_REQUESTS_PER_MINUTE: "2147483648" })).toThrow(/^(?!.*2147483648).*MAX_REQUESTS_PER_MINUTE.*$/);
    });
});
