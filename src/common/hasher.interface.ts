export interface Hasher {
    hash(key: string, cost?: number): Promise<string>
    compare(password: string, hash: string): Promise<boolean>
}
