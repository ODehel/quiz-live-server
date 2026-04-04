import { IPasswordValidator } from "./IPasswordValidator";

export class PasswordValidator implements IPasswordValidator {
    validate(password: string): boolean {
        return password.length >= 12 && password.length <= 72 && /^[\x20-\x7E]+$/.test(password);
    }
}