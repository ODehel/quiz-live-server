import { PasswordValidator } from "./password-validator.interface";

export class OwaspPasswordValidator implements PasswordValidator {
    validate(password: string): boolean {
        return password.length >= 12 && password.length <= 72 && /^[\x20-\x7E]+$/.test(password);
    }
}