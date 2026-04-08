import { UserRole } from "./user-role";

export interface User {
    id: string;
    username: string;
    password: string;
    role: UserRole;
}