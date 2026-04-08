import { uuidv7 } from "uuidv7";
import { Environment } from "../common/environment.interface"
import { Hasher } from "../common/hasher.interface";
import { PasswordValidator } from "./password-validator.interface";
import { UserRepository } from "./user-repository.interface"
import { UserRole } from "./user-role"

export class SeedUsers {
    private repository: UserRepository;
    private hasher: Hasher;
    private passwordValidator: PasswordValidator;
    constructor(repository: UserRepository, hasher: Hasher, passwordValidator: PasswordValidator) {
        this.repository = repository;
        this.hasher = hasher;
        this.passwordValidator = passwordValidator;
    }

    public async seed(environment: Environment) {
        if (this.passwordsCantValidate(environment)) {
            throw new Error("Invalid password");
        }
        const userCount = await this.repository.count()
        if (userCount === 0) {
            const buzzers = await Promise.all(
                Array.from({ length: 10 }, async (_, i) => ({
                    id: uuidv7(),
                    username: `quiz_buzzer_${String(i + 1).padStart(2, '0')}`,
                    password: await this.hasher.hash(environment.playerPassword),
                    role: UserRole.PLAYER
                }))
            );
            const defaultUsers = [
                ...buzzers,
                { id: uuidv7(), username: 'admin', password: await this.hasher.hash(environment.adminPassword), role: UserRole.ADMIN }
            ]
            for (const user of defaultUsers) {
                await this.repository.insert(user)
            }
        }
    }

    private passwordsCantValidate(environment: Environment) {
        return !this.passwordValidator.validate(environment.adminPassword) || !this.passwordValidator.validate(environment.playerPassword);
    }
}