import { UserRole } from "./UserRole";

export interface IUser {
    username: string;
    password: string;
    role: UserRole;
}