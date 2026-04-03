import { IUserRepository } from "./IUserRepository"
import { UserRole } from "./UserRole"

export class SeedUsers {
    private repository: IUserRepository
    constructor(repository: IUserRepository) {
        this.repository = repository
    }

    public async seed() {
        const userCount = await this.repository.count()
        if (userCount === 0) {
            const buzzers = Array.from({ length: 10 }, (_, i) => ({
                username: `quiz_buzzer_${String(i + 1).padStart(2, '0')}`,
                password: `password${i + 1}`,
                role: UserRole.PLAYER
            }))
            const defaultUsers = [
                ...buzzers,
                { username: 'admin', password: 'admin', role: UserRole.ADMIN }
            ]
            for (const user of defaultUsers) {
                await this.repository.insert(user)
            }
        }
    }
}