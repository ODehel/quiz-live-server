import { uuidv7 } from "uuidv7";
import { Hasher } from "../common/hasher.interface";
import { PasswordValidator } from "./password-validator.interface";
import { UserRepository } from "./user-repository.interface"
import { UserRole } from "./user-role"
import { SeedUserConfiguration } from "./seed-user-configuration.interface";

export type SeedResult = { created: true } | { created: false; message: string };

const TABLE_NOT_EMPTY_MESSAGE = "Seed ignoré — la table T_USER_USR contient déjà des comptes.";
const ADMIN_LOGIN = 'admin';
const BUZZER_LOGINS = Array.from({ length: 10 }, (_, i) => `quiz_buzzer_${String(i + 1).padStart(2, '0')}`);

export class SeedUsers {
    private repository: UserRepository;
    private hasher: Hasher;
    private passwordValidator: PasswordValidator;
    constructor(repository: UserRepository, hasher: Hasher, passwordValidator: PasswordValidator) {
        this.repository = repository;
        this.hasher = hasher;
        this.passwordValidator = passwordValidator;
    }

    public async seed(configuration: SeedUserConfiguration): Promise<SeedResult> {
        const userCount = await this.repository.count()
        if (userCount !== 0) {
            return { created: false, message: TABLE_NOT_EMPTY_MESSAGE };
        }
        const passwords = this.readValidPasswords(configuration);
        const buzzers = await Promise.all(
            BUZZER_LOGINS.map(async (login) => ({
                id: uuidv7(),
                username: login,
                password: await this.hasher.hash(passwords.get(login)!),
                role: UserRole.PLAYER
            }))
        );
        const defaultUsers = [
            ...buzzers,
            { id: uuidv7(), username: ADMIN_LOGIN, password: await this.hasher.hash(passwords.get(ADMIN_LOGIN)!), role: UserRole.ADMIN }
        ]
        for (const user of defaultUsers) {
            await this.repository.insert(user)
        }
        return { created: true };
    }

    private readValidPasswords(configuration: SeedUserConfiguration): Map<string, string> {
        const passwords = new Map<string, string>();
        for (const login of [ADMIN_LOGIN, ...BUZZER_LOGINS]) {
            const password = configuration.seedPasswordFor(login);
            if (password === undefined) {
                throw new Error(`Missing password for account ${login}`);
            }
            if (!this.passwordValidator.validate(password)) {
                throw new Error(`Invalid password for account ${login}`);
            }
            passwords.set(login, password);
        }
        return passwords;
    }
}
