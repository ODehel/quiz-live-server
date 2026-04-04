export interface IHasher {
    hash(key: string): Promise<string>
}