export interface TokenValidator {
    validateToken(token: string): boolean;
}