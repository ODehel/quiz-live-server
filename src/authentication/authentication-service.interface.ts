import { IUser } from "../users/IUser";

export interface AuthenticationService {
    authenticate(login: string, password: string): Promise<IUser | undefined>;
}