import 'dotenv/config'
import { SqliteUserRepository } from "./users/sqlite-user-repository";
import { SeedUsers } from "./users/seed-users";
import { BcryptHasher } from './infrastructure/bcrypt-hasher';
import { OwaspPasswordValidator } from './users/owasp-password-validator';
import { ProcessEnvironment } from './common/process-environment';

const environment: ProcessEnvironment = new ProcessEnvironment();
const userRepository: SqliteUserRepository = new SqliteUserRepository(environment.sqliteDbPath);
const hasher = new BcryptHasher();
const passwordValidator = new OwaspPasswordValidator();
const seedUsers: SeedUsers = new SeedUsers(userRepository, hasher, passwordValidator);
seedUsers.seed(environment);