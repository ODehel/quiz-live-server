import 'dotenv/config'
import { SqliteUserRepository } from "./users/sqlite-user-repository";
import { SeedUsers } from "./users/seed-users";
import { BcryptHasher } from './infrastructure/bcrypt-hasher';
import { OwaspPasswordValidator } from './users/owasp-password-validator';

const userRepository: SqliteUserRepository = new SqliteUserRepository(process.env.DATABASE_PATH || "database.sqlite");
const hasher = new BcryptHasher();
const passwordValidator = new OwaspPasswordValidator();
const seedUsers: SeedUsers = new SeedUsers(userRepository, hasher, passwordValidator);
const environment = {
    playerPassword: process.env.BUZZER_DEFAULT_PASSWORD || "player123",
    adminPassword: process.env.ADMIN_PASSWORD || "admin123"
}
seedUsers.seed(environment);