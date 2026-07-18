import { beforeEach, describe, expect, it } from "vitest";
import { SqliteUserRepository } from "./sqlite-user-repository";
import { User } from "./user.interface";
import { UserRole } from "./user-role";

let repository: SqliteUserRepository;
let user: User;

beforeEach(() => {
    repository = new SqliteUserRepository(":memory:");
    user = {
        id: "019f751c-5d8b-76ab-bafb-2c0d589846ed",
        username: "any-login",
        password: "any-password",
        role: UserRole.PLAYER
    };
});

describe("Sqlite User repository", () => {
    it("should return the user with the specified id", async () => {
        await repository.insert(user);
        const searchedUser = await repository.retrieveById(user.id);
        expect(searchedUser).toEqual(user);
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
});