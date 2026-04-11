import { describe, expect, it } from "vitest";
import { Uuidv7Generator } from "./uuidv7-generator";

describe("US-004/CA-05 - generation of uuidV7", () => {
    it('should generate a uuidv7 with correct format', () => {
        const generator = new Uuidv7Generator();
        const uuid = generator.generate();
        const comparison = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);

        expect(comparison).toBe(true);
    });
});