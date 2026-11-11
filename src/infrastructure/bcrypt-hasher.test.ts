import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import { BcryptHasher } from "./bcrypt-hasher";

describe("BcryptHasher", () => {
    it("should hash with a cost of 12", async () => {
        const hash: string = await new BcryptHasher().hash("Correct-Horse-9");
        expect(hash).toMatch(/^\$2b\$12\$/);
    });

    it("should compare a password to a hash of cost 12", async () => {
        const hasher = new BcryptHasher();
        const hash: string = await hasher.hash("Correct-Horse-9");
        expect(await hasher.compare("Correct-Horse-9", hash)).toBe(true);
        expect(await hasher.compare("Wrong-Horse-9", hash)).toBe(false);
    });

    it("should still compare a password to a hash of cost 10", async () => {
        const existingHash: string = bcrypt.hashSync("Correct-Horse-9", 10);
        expect(existingHash).toMatch(/^\$2b\$10\$/);
        expect(await new BcryptHasher().compare("Correct-Horse-9", existingHash)).toBe(true);
    });

    it("US-002/CA-6 should hash with the cost it is given", async () => {
        const hash: string = await new BcryptHasher().hash("Correct-Horse-9", 5);
        expect(hash).toMatch(/^\$2b\$05\$/);
    });
});
