import 'dotenv/config'
import { SqliteUserRepository } from "./users/sqlite-user-repository";
import { SeedUsers } from "./users/seed-users";
import { BcryptHasher } from './infrastructure/bcrypt-hasher';
import { OwaspPasswordValidator } from './users/owasp-password-validator';
import { ProcessEnvironment } from './common/process-environment';
import { SeedUserConfiguration } from './users/seed-user-configuration.interface';

const environment: ProcessEnvironment = new ProcessEnvironment();
const userRepository: SqliteUserRepository = new SqliteUserRepository(environment.sqliteDbPath);
const hasher = new BcryptHasher();
const passwordValidator = new OwaspPasswordValidator();
const seedUsers: SeedUsers = new SeedUsers(userRepository, hasher, passwordValidator);
const seedUserConfiguration: SeedUserConfiguration = { adminPassword: environment.adminPassword, playerDefaultPassword: environment.playerPassword };
seedUsers.seed(seedUserConfiguration);