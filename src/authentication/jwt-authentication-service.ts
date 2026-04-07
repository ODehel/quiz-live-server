import { IHasher } from "../common/IHasher";
import { IUser } from "../users/IUser";
import { IUserRepository } from "../users/IUserRepository";
import { AuthenticationService } from "./authentication-service.interface";

export class JwtAuthenticationService implements AuthenticationService {
    private userRepository: IUserRepository;
    private hasher: IHasher;
    constructor(userRepository: IUserRepository, hasher: IHasher) {
        this.userRepository = userRepository;
        this.hasher = hasher;
    }

    async authenticate(login: string, password: string): Promise<IUser | undefined> {
        const user = await this.userRepository.retrieveByLogin(login);
        if (!user) {
            return undefined;
        }
        const isPasswordValid = await this.hasher.compare(password, user.password);
        if (!isPasswordValid) {
            return undefined;
        }
        return user;
    }
}