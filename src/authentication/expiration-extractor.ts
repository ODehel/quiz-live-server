export interface ExpirationExtractor {
    extract(token: string): number;
}