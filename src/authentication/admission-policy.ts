import { TokenValidator } from "./token-validator.interface";

export enum AuthOutcome { Success, Rejected };

export class AdmissionPolicy {
    constructor(private readonly tokenValidator: TokenValidator) {

    }

    evaluate(token: string): AuthOutcome {
        return this.tokenValidator.validateToken(token) 
            ? AuthOutcome.Success 
            : AuthOutcome.Rejected;
    }
}