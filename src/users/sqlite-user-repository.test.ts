import { beforeEach, describe, expect, it } from "vitest";
import { SqliteUserRepository } from "./sqlite-user-repository";
import { User } from "./user.interface";
import { UserRole } from "./user-role";
import Database from "better-sqlite3";

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
