import { IUser } from "./IUser"

export interface IUserRepository {
    count(): Promise<number>
    insert(user: IUser): Promise<void>
}