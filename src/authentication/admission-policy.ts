import { TokenValidator } from "./token-validator.interface";
import { ParticipantResolver } from "./participant-resolver.interface";
import { SubjectExtractor } from "./subject-extractor.interface";
import { Participant } from "./participant.interface";

export enum AuthOutcome { Success, Rejected };

export type AdmissionResult =
  | { authOutcome: AuthOutcome.Success; participant: Participant }
  | { authOutcome: AuthOutcome.Rejected };


export class AdmissionPolicy {
    constructor(private readonly tokenValidator: TokenValidator, 
        private readonly participantResolver: ParticipantResolver,
        private readonly subjectExtractor: SubjectExtractor) {
    }

    evaluate(token: string): AdmissionResult {
        if (!this.tokenValidator.validateToken(token))
            return { authOutcome: AuthOutcome.Rejected };

        const sub: string = this.subjectExtractor.extract(token);
        const participant: Participant | null = this.participantResolver.resolve(sub);

        return participant !== null
            ? { authOutcome: AuthOutcome.Success, participant } 
            : { authOutcome: AuthOutcome.Rejected };
    }
}