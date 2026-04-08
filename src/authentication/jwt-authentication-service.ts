import { Hasher } from "../common/hasher.interface";
import { User } from "../users/user.interface";
import { UserRepository } from "../users/user-repository.interface";
import { AuthenticationService } from "./authentication-service.interface";

export class JwtAuthenticationService implements AuthenticationService {
    private userRepository: UserRepository;
    private hasher: Hasher;
    constructor(userRepository: UserRepository, hasher: Hasher) {
        this.userRepository = userRepository;
        this.hasher = hasher;
    }

    async authenticate(login: string, password: string): Promise<User | undefined> {
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