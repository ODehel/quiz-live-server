import { describe, expect, it } from "vitest";
import { UserRole } from "./user-role";
import { fromRoleLabel, toRoleLabel } from "./role-label";

describe("Role label", () => {
    it("translates the player role to the buzzer label", () => {
        expect(toRoleLabel(UserRole.PLAYER)).toBe("buzzer");
    });
    it("translates the admin role to the admin label", () => {
        expect(toRoleLabel(UserRole.ADMIN)).toBe("admin");
    });
    it.each([UserRole.ADMIN, UserRole.PLAYER])("gives back the role %s from its own label", (role) => {
        expect(fromRoleLabel(toRoleLabel(role))).toBe(role);
    });
    it.each(["superadmin", "constructor", 0, 1, undefined])("gives no role for the label %s", (label) => {
        expect(fromRoleLabel(label)).toBeUndefined();
    });
});
