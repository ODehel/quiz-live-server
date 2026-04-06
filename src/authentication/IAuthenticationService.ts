import { IUser } from "../users/IUser";

export interface IAuthenticationService {
    authenticate(login: string, password: string): Promise<IUser | undefined>;
}