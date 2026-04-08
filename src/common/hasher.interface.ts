export interface Hasher {
    hash(key: string): Promise<string>
    compare(password: string, hash: string): Promise<boolean>
}