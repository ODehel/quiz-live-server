import { Hasher } from "../common/hasher.interface"
import bcrypt from 'bcryptjs'

const DEFAULT_COST_FACTOR = 12;

export class BcryptHasher implements Hasher {
    async hash(password: string, cost: number = DEFAULT_COST_FACTOR): Promise<string> {
        return bcrypt.hash(password, cost);
    }

    async compare(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash);
    }
}
