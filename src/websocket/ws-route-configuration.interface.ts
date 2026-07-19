import { ParticipantResolver } from "../authentication/participant-resolver.interface";
import { SubjectExtractor } from "../authentication/subject-extractor.interface";
import { TokenValidator } from "../authentication/token-validator.interface";
import { Scheduler } from "../common/scheduler.interface";

export interface WsRouteConfiguration {
    tokenValidator: TokenValidator;
    scheduler: Scheduler;
    subjectExtractor: SubjectExtractor;
    participantResolver: ParticipantResolver;
}