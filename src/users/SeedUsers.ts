import { IEnvironment } from "../common/IEnvironment"
import { IHasher } from "../common/IHasher";
import { IPasswordValidator } from "./IPasswordValidator";
import { IUserRepository } from "./IUserRepository"
import { UserRole } from "./UserRole"

export class SeedUsers {
    private repository: IUserRepository;
    private hasher: IHasher;
    private passwordValidator: IPasswordValidator;
    constructor(repository: IUserRepository, hasher: IHasher, passwordValidator: IPasswordValidator) {
        this.repository = repository;
        this.hasher = hasher;
        this.passwordValidator = passwordValidator;
    }

    public async seed(environment: IEnvironment) {
        if (this.passwordsCantValidate(environment)) {
            throw new Error("Invalid password");
        }
        const userCount = await this.repository.count()
        if (userCount === 0) {
            const buzzers = await Promise.all(
                Array.from({ length: 10 }, async (_, i) => ({
                    username: `quiz_buzzer_${String(i + 1).padStart(2, '0')}`,
                    password: await this.hasher.hash(environment.playerPassword),
                    role: UserRole.PLAYER
                }))
            );
            const defaultUsers = [
                ...buzzers,
                { username: 'admin', password: await this.hasher.hash(environment.adminPassword), role: UserRole.ADMIN }
            ]
            for (const user of defaultUsers) {
                await this.repository.insert(user)
            }
        }
    }

    private passwordsCantValidate(environment: IEnvironment) {
        return !this.passwordValidator.validate(environment.adminPassword) || !this.passwordValidator.validate(environment.playerPassword);
    }
}