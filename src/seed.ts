import 'dotenv/config'
import { SqliteUserRepository } from "./infrastructure/SqliteUserRepository";
import { SeedUsers } from "./users/SeedUsers";

const userRepository: SqliteUserRepository = new SqliteUserRepository(process.env.DATABASE_PATH || "database.sqlite");
const seedUsers: SeedUsers = new SeedUsers(userRepository);
seedUsers.seed();