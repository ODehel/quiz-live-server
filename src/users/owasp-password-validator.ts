import { PasswordValidator } from "./password-validator.interface";

const PRINTABLE_ASCII = /^[\x20-\x7E]+$/;
const NOT_A_SPACE = /[^ ]/;

export class OwaspPasswordValidator implements PasswordValidator {
    validate(password: string): boolean {
        return password.length >= 12
            && password.length <= 72
            && PRINTABLE_ASCII.test(password)
            && NOT_A_SPACE.test(password);
    }
}
