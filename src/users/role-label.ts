import { UserRole } from "./user-role";

const roleLabels: Record<UserRole, "admin" | "buzzer"> = {
  [UserRole.ADMIN]: "admin",
  [UserRole.PLAYER]: "buzzer"
};

export function toRoleLabel(role: UserRole): "admin" | "buzzer" {
    return roleLabels[role];
}