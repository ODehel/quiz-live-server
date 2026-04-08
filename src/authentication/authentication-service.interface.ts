import { User } from "../users/user.interface";

export interface AuthenticationService {
    authenticate(login: string, password: string): Promise<User | undefined>;
}