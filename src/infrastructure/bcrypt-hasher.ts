import { Hasher } from "../common/hasher.interface"
import bcrypt from 'bcryptjs'

export class BcryptHasher implements Hasher {
    async hash(password: string): Promise<string> {
        const saltRounds = 10;
        return bcrypt.hash(password, saltRounds);
    }

    async compare(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash);
    }
}