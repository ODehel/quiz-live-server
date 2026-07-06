import { TokenValidator } from "./token-validator.interface";
import { ParticipantResolver } from "./participant-resolver.interface";

export enum AuthOutcome { Success, Rejected };

export class AdmissionPolicy {
    constructor(private readonly tokenValidator: TokenValidator, private readonly participantResolver: ParticipantResolver) {

    }

    evaluate(token: string): AuthOutcome {
        const subjectPlaceholder = "";
        return this.tokenValidator.validateToken(token) && this.participantResolver.exists(subjectPlaceholder)
            ? AuthOutcome.Success 
            : AuthOutcome.Rejected;
    }
}