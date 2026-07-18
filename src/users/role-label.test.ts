import { describe, expect, it } from "vitest";
import { UserRole } from "./user-role";
import { toRoleLabel } from "./role-label";

describe("Role label", () => {
    it("translates the player role to the buzzer label", () => {
        expect(toRoleLabel(UserRole.PLAYER)).toBe("buzzer");
    });
    it("translates the admin role to the admin label", () => {
        expect(toRoleLabel(UserRole.ADMIN)).toBe("admin");
    });
});