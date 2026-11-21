import 'dotenv/config'
import { SqliteUserRepository } from "./users/sqlite-user-repository";
import { SeedUsers } from "./users/seed-users";
import { BcryptHasher } from './infrastructure/bcrypt-hasher';
import { OwaspPasswordValidator } from './users/owasp-password-validator';
import { ProcessEnvironment } from './common/process-environment';
import Database from 'better-sqlite3';

// Everything runs inside the promise, in the order of US-002: SQLITE_DB_PATH (ProcessEnvironment), then the opening of the database
// and its first statement (the table created by the repository constructor), then the table, the passwords and BCRYPT_COST (SeedUsers).
// A single failure, whichever the step, leaves through the one catch below.
async function seed(): Promise<void> {
    const environment: ProcessEnvironment = new ProcessEnvironment();
    const userRepository: SqliteUserRepository = new SqliteUserRepository(new Database(environment.sqliteDbPath));
    const hasher = new BcryptHasher();
    const passwordValidator = new OwaspPasswordValidator();
    const seedUsers: SeedUsers = new SeedUsers(userRepository, hasher, passwordValidator);
    const result = await seedUsers.seed(environment);
    console.log(result.message);
}

seed().catch((error: unknown) => {
    console.error("User seeding failed: " + (error instanceof Error ? error.message : String(error)));
    process.exit(1);
});
