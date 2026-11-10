import { UserRole } from "./user-role";

const roleLabels: Record<UserRole, "admin" | "buzzer"> = {
  [UserRole.ADMIN]: "admin",
  [UserRole.PLAYER]: "buzzer"
};

const rolesByLabel = new Map<unknown, UserRole>([
  ["admin", UserRole.ADMIN],
  ["buzzer", UserRole.PLAYER]
]);

export function toRoleLabel(role: UserRole): "admin" | "buzzer" {
    return roleLabels[role];
}

export function fromRoleLabel(label: unknown): UserRole | undefined {
    return rolesByLabel.get(label);
}
