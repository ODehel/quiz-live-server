export interface IPasswordValidator {
    validate(password: string): boolean;
}