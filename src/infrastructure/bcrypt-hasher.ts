import { Hasher } from "../common/hasher.interface"
import bcrypt from 'bcryptjs'

const COST_FACTOR = 12;

export class BcryptHasher implements Hasher {
    async hash(password: string): Promise<string> {
        return bcrypt.hash(password, COST_FACTOR);
    }

    async compare(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash);
    }
}
