import { UserRole } from "./UserRole";

export interface IUser {
    id: string;
    username: string;
    password: string;
    role: UserRole;
}