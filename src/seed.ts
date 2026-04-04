import 'dotenv/config'
import { SqliteUserRepository } from "./infrastructure/SqliteUserRepository";
import { SeedUsers } from "./users/SeedUsers";
import { BcryptHasher } from './infrastructure/BcryptHasher';
import { PasswordValidator } from './users/PasswordValidator';

const userRepository: SqliteUserRepository = new SqliteUserRepository(process.env.DATABASE_PATH || "database.sqlite");
const hasher = new BcryptHasher();
const passwordValidator = new PasswordValidator();
const seedUsers: SeedUsers = new SeedUsers(userRepository, hasher, passwordValidator);
const environment = {
    playerPassword: process.env.BUZZER_DEFAULT_PASSWORD || "player123",
    adminPassword: process.env.ADMIN_PASSWORD || "admin123"
}
seedUsers.seed(environment);