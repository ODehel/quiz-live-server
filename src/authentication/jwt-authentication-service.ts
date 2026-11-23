import { Hasher } from "../common/hasher.interface";
import { User } from "../users/user.interface";
import { UserRepository } from "../users/user-repository.interface";
import { AuthenticationService } from "./authentication-service.interface";

// Hash bcrypt valide de coût 12 (défaut du seed), qui ne correspond à aucun compte réel.
// La comparaison factice pour un login inconnu paie le même coût qu'une vraie comparaison.
const DUMMY_PASSWORD_HASH = "$2b$12$u.OIhAI3TwigW0ecvDRp6eSAgmWYtZ/wNaG5lip7Xu1BhOh//NNNC";

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
            await this.hasher.compare(password, DUMMY_PASSWORD_HASH);
            return undefined;
        }
        const isPasswordValid = await this.hasher.compare(password, user.password);
        if (!isPasswordValid) {
            return undefined;
        }
        return user;
    }
}
