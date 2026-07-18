export interface TokenValidator {
    validateToken(token: string): boolean;
    inspectToken(token: string): { valid: boolean, reason: string };
}