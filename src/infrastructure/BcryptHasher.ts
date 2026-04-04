import { IHasher } from "../common/IHasher"
import bcrypt from 'bcryptjs'

export class BcryptHasher implements IHasher {
    async hash(password: string): Promise<string> {
        const saltRounds = 10;
        return bcrypt.hash(password, saltRounds);
    }
}