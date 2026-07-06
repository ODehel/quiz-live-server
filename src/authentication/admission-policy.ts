import { TokenValidator } from "./token-validator.interface";
import { ParticipantResolver } from "./participant-resolver.interface";
import { SubjectExtractor } from "./subject-extractor.interface";

export enum AuthOutcome { Success, Rejected };

export class AdmissionPolicy {
    constructor(private readonly tokenValidator: TokenValidator, 
        private readonly participantResolver: ParticipantResolver,
        private readonly subjectExtractor: SubjectExtractor) {
    }

    evaluate(token: string): AuthOutcome {
        return this.tokenValidator.validateToken(token) && this.participantResolver.exists(this.subjectExtractor.extract("autre-chose"))
            ? AuthOutcome.Success 
            : AuthOutcome.Rejected;
    }
}