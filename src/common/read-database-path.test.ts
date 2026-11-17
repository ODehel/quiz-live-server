import { describe, expect, it } from "vitest";
import { readDatabasePath } from "./read-database-path";

const REFUSAL = "SQLITE_DB_PATH cannot be empty or made only of whitespace.";

// The closed list of the 25 whitespace characters of US-001/CA-10 (decision #61).
const WHITESPACES: Array<[string, string]> = [
    ["U+0020 space", "\u0020"],
    ["U+0009 tab", "\u0009"],
    ["U+000A line feed", "\u000A"],
    ["U+000B vertical tab", "\u000B"],
    ["U+000C form feed", "\u000C"],
    ["U+000D carriage return", "\u000D"],
    ["U+00A0 no-break space", "\u00A0"],
    ["U+1680 ogham space mark", "\u1680"],
    ...Array.from({ length: 11 }, (_, i): [string, string] => [`U+${(0x2000 + i).toString(16).toUpperCase()} typographic space`, String.fromCharCode(0x2000 + i)]),
    ["U+2028 line separator", "\u2028"],
    ["U+2029 paragraph separator", "\u2029"],
    ["U+202F narrow no-break space", "\u202F"],
    ["U+205F medium mathematical space", "\u205F"],
    ["U+3000 ideographic space", "\u3000"],
    ["U+FEFF byte order mark", "\uFEFF"]
];

// Not whitespace for the rule, although some are invisible or trimmed by other tools.
const NOT_WHITESPACES: Array<[string, string]> = [
    ["U+200B zero width space", "\u200B"],
    ["U+0085 next line", "\u0085"],
    ["U+180E mongolian vowel separator", "\u180E"]
];

describe("readDatabasePath", () => {
    it("US-001/CA-10 provides quiz.db when the variable is absent", () => {
        expect(readDatabasePath(undefined)).toBe("quiz.db");
    });

    it("US-001/CA-10 provides the path as written", () => {
        expect(readDatabasePath("./data/hub.db")).toBe("./data/hub.db");
    });

    it("US-001/CA-10 refuses an empty string instead of treating it as absent", () => {
        expect(() => readDatabasePath("")).toThrow(REFUSAL);
    });

    it("the list holds the 25 whitespace characters", () => {
        expect(WHITESPACES).toHaveLength(25);
    });

    it.each(WHITESPACES)("US-001/CA-10 refuses a value made only of %j, alone or repeated", (_name, blank) => {
        expect(() => readDatabasePath(blank)).toThrow(REFUSAL);
        expect(() => readDatabasePath(blank.repeat(3))).toThrow(REFUSAL);
    });

    it("US-001/CA-10 refuses a mix of whitespace characters", () => {
        expect(() => readDatabasePath(" \t\r\n\u00A0\u3000\uFEFF ")).toThrow(REFUSAL);
    });

    it.each(WHITESPACES)("US-001/CA-10 ignores %j around a path", (_name, blank) => {
        expect(readDatabasePath(blank + "quiz.db")).toBe("quiz.db");
        expect(readDatabasePath("quiz.db" + blank)).toBe("quiz.db");
        expect(readDatabasePath(blank.repeat(2) + "quiz.db" + blank.repeat(2))).toBe("quiz.db");
    });

    it("US-001/CA-10 ignores a mix of whitespace characters around a path", () => {
        expect(readDatabasePath("\t\r\n quiz.db \r\n")).toBe("quiz.db");
    });

    it("US-001/CA-10 keeps the whitespace inside a path", () => {
        expect(readDatabasePath("qu iz.db")).toBe("qu iz.db");
        expect(readDatabasePath(" qu\tiz.db ")).toBe("qu\tiz.db");
    });

    it.each(NOT_WHITESPACES)("US-001/CA-10 does not take %j for whitespace: alone it is a one-character path", (_name, character) => {
        expect(readDatabasePath(character)).toBe(character);
    });

    it.each(NOT_WHITESPACES)("US-001/CA-10 keeps %j around a path", (_name, character) => {
        expect(readDatabasePath(character + "quiz.db" + character)).toBe(character + "quiz.db" + character);
    });

    it("US-001/CA-10 removes the whitespace that follows a U+200B but keeps the U+200B itself", () => {
        expect(readDatabasePath("\u200B ")).toBe("\u200B");
    });

    it("US-001/CA-10 does not refuse :memory:, bordered or not", () => {
        expect(readDatabasePath(":memory:")).toBe(":memory:");
        expect(readDatabasePath(" :memory: ")).toBe(":memory:");
    });
});
