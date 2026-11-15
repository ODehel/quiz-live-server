const DEFAULT_DATABASE_PATH = "quiz.db";

// The closed list of whitespace characters of US-001/CA-10 (decision #61): 25 characters, and only them.
// Not delegated to String.prototype.trim() nor to better-sqlite3, so that the rule does not follow a library version.
const WHITESPACES: ReadonlySet<string> = new Set([
    "\u0020", "\u0009", "\u000A", "\u000B", "\u000C", "\u000D", "\u00A0", "\u1680",
    "\u2000", "\u2001", "\u2002", "\u2003", "\u2004", "\u2005", "\u2006", "\u2007", "\u2008", "\u2009", "\u200A",
    "\u2028", "\u2029", "\u202F", "\u205F", "\u3000", "\uFEFF"
]);

export function readDatabasePath(value: string | undefined): string {
    if (value === undefined) {
        return DEFAULT_DATABASE_PATH;
    }
    let start = 0;
    let end = value.length;
    while (start < end && WHITESPACES.has(value.charAt(start))) {
        start++;
    }
    while (end > start && WHITESPACES.has(value.charAt(end - 1))) {
        end--;
    }
    if (start === end) {
        throw new Error("SQLITE_DB_PATH cannot be empty or made only of whitespace.");
    }
    return value.slice(start, end);
}
