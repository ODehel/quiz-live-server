import { UserRole } from "../users/user-role";

export interface Participant {
    id: string,
    username: string,
    role: UserRole
}
