import { describe, expect, it } from "vitest";
import { rawDataToString } from "./raw-data-to-string";

describe("rawDataToString", () => {
    it("should decode a buffer as UTF-8 text", () => {
        expect(rawDataToString(Buffer.from("héllo"))).toBe("héllo");
    });

    it("should decode fragments as one text even when a character is split between two of them", () => {
        const fragments = [Buffer.from([0x68, 0xc3]), Buffer.from([0xa9, 0x6c])];

        expect(rawDataToString(fragments)).toBe("hél");
    });

    it("should decode an array buffer as UTF-8 text", () => {
        const arrayBuffer = new Uint8Array(Buffer.from("héllo")).buffer;

        expect(rawDataToString(arrayBuffer)).toBe("héllo");
    });
});
