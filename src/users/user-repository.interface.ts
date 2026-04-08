import { User } from "./user.interface"

export interface UserRepository {
    count(): Promise<number>
    insert(user: User): Promise<void>
    retrieveByLogin(login: string): Promise<User | undefined>
}