import { User } from "./user.interface"

export interface UserRepository {
    count(): Promise<number>;
    insert(user: User): Promise<void>;
    // Writes every user, or none of them, and only when the table holds no account at the moment of the write:
    // resolves to the number of users written, or to 0 when the table already held an account (nothing is written then).
    insertAllIfEmpty(users: User[]): Promise<number>;
    retrieveByLogin(login: string): Promise<User | undefined>;
    retrieveById(id: string): Promise<User | undefined>;
}
