import { UserRole } from "../users/user-role";

export interface DecodedToken {
    role: UserRole;
}