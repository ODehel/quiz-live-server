import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SqliteUserRepository } from "./sqlite-user-repository";
import { User } from "./user.interface";
import { UserRole } from "./user-role";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let database: Database.Database;
let repository: SqliteUserRepository;
let user: User;

beforeEach(() => {
    database = new Database(":memory:");
    repository = new SqliteUserRepository(database);
    user = {
        id: "019f751c-5d8b-76ab-bafb-2c0d589846ed",
        username: "any-login",
        password: "any-password",
        role: UserRole.PLAYER
    };
});

describe("Sqlite User repository", () => {
    it.each([UserRole.ADMIN, UserRole.PLAYER])("should return the user with the specified id and the role %s", async (role) => {
        await repository.insert({ ...user, role });
        const searchedUser = await repository.retrieveById(user.id);
        expect(searchedUser).toEqual({ ...user, role });
    });

    it.each([UserRole.ADMIN, UserRole.PLAYER])("should return the user with the specified login and the role %s", async (role) => {
        await repository.insert({ ...user, role });
        const searchedUser = await repository.retrieveByLogin(user.username);
        expect(searchedUser).toEqual({ ...user, role });
    });

    it("should return undefined when user is not in database", async () => {
        await repository.insert({
            id: "019f752c-89ab-7b0a-8b6e-690b063b9136",
            username: "a-user-name",
            password: "it-is-a-secret",
            role: UserRole.ADMIN
        });
        const searchedUser = await repository.retrieveById(user.id);
        expect(searchedUser).toBeUndefined();
    });

    it.each([
        [UserRole.ADMIN, "admin"],
        [UserRole.PLAYER, "buzzer"]
    ])("should store the role %s under the label %s", async (role, label) => {
        await repository.insert({ ...user, role });
        const row = database.prepare("SELECT USR_ROLE FROM T_USER_USR WHERE USR_ID = ?").get(user.id);
        expect(row).toEqual({ USR_ROLE: label });
    });

    it.each([0, 1, "superadmin", "Admin", "", null])("should refuse a stored role of %s", (role) => {
        const insertRaw = () => database
            .prepare("INSERT INTO T_USER_USR (USR_ID, USR_LOGIN, USR_HASH_PASSWORD, USR_ROLE) VALUES (?, ?, ?, ?)")
            .run(user.id, user.username, user.password, role);
        expect(insertRaw).toThrow(/constraint/i);
    });

    it("should give the buzzer role to a user inserted without role", async () => {
        database
            .prepare("INSERT INTO T_USER_USR (USR_ID, USR_LOGIN, USR_HASH_PASSWORD) VALUES (?, ?, ?)")
            .run(user.id, user.username, user.password);
        const searchedUser = await repository.retrieveById(user.id);
        expect(searchedUser?.role).toBe(UserRole.PLAYER);
    });

    it("should declare the role column as a non-null text defaulting to buzzer", () => {
        const columns = database.prepare("PRAGMA table_info(T_USER_USR)").all() as { name: string; type: string; notnull: number; dflt_value: string | null }[];
        expect(columns.find(column => column.name === "USR_ROLE")).toMatchObject({ type: "TEXT", notnull: 1, dflt_value: "'buzzer'" });
    });
});

describe("Sqlite User repository - insertAllIfEmpty (all or none, only on an empty table)", () => {
    const aBatch = (prefix: string): User[] => Array.from({ length: 3 }, (_, i) => ({
        id: `${prefix}-id-${i}`,
        username: `${prefix}-login-${i}`,
        password: `${prefix}-hash-${i}`,
        role: UserRole.PLAYER
    }));
    const storedLogins = (db: Database.Database = database) =>
        (db.prepare("SELECT USR_LOGIN FROM T_USER_USR ORDER BY USR_LOGIN").all() as { USR_LOGIN: string }[]).map(row => row.USR_LOGIN);

    it("should write every user and say how many when the table is empty", async () => {
        const written = await repository.insertAllIfEmpty(aBatch("a"));
        expect(written).toBe(3);
        expect(storedLogins()).toEqual(["a-login-0", "a-login-1", "a-login-2"]);
    });

    it("should write nothing and say zero when the table already holds an account", async () => {
        await repository.insert(user);
        const written = await repository.insertAllIfEmpty(aBatch("a"));
        expect(written).toBe(0);
        expect(storedLogins()).toEqual(["any-login"]);
    });

    it("should leave no user at all when one of them cannot be written", async () => {
        const [first, second] = aBatch("a");
        const batch = [first!, second!, { ...second!, id: "a-id-other", username: first!.username }];
        await expect(repository.insertAllIfEmpty(batch)).rejects.toThrow(/UNIQUE/);
        expect(storedLogins()).toEqual([]);
    });

    describe("with two connections on the same database file", () => {
        let directory: string;
        let first: Database.Database;
        let second: Database.Database;
        beforeEach(() => {
            directory = mkdtempSync(join(tmpdir(), "quiz-user-repository-"));
            first = new Database(join(directory, "quiz.db"));
            second = new Database(join(directory, "quiz.db"));
        });
        afterEach(() => {
            first.close();
            second.close();
            rmSync(directory, { recursive: true, force: true });
        });

        it("should write nothing when another connection filled the table first, and keep the accounts of that connection", async () => {
            const winner = new SqliteUserRepository(first);
            const loser = new SqliteUserRepository(second);
            expect(await winner.insertAllIfEmpty(aBatch("winner"))).toBe(3);
            expect(await loser.insertAllIfEmpty(aBatch("loser"))).toBe(0);
            expect(storedLogins(second)).toEqual(["winner-login-0", "winner-login-1", "winner-login-2"]);
        });
    });
});
