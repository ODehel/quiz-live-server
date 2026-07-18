import { TokenValidator } from "./token-validator.interface";
import jwt from "jsonwebtoken";

export class JwtValidator implements TokenValidator {
    private secretKey: string;
    constructor(secretKey: string) {
        this.secretKey = secretKey;
    }
    validateToken(token: string): boolean {
        try {
            jwt.verify(token, this.secretKey);
            return true;
        } catch (error) {
            return false;
        }
    }
    inspectToken(token: string): { valid: boolean, reason: string } {
        try {
            jwt.verify(token, this.secretKey);
            return { valid: true, reason: "valid" };
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError)
                return { valid: false, reason: "expired" };
            return { valid: false, reason: "invalid" };
        }
    }
}