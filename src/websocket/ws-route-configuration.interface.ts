import { ExpirationExtractor } from "../authentication/expiration-extractor";
import { ParticipantResolver } from "../authentication/participant-resolver.interface";
import { SubjectExtractor } from "../authentication/subject-extractor.interface";
import { TokenValidator } from "../authentication/token-validator.interface";
import { Clock } from "../common/clock.interface";
import { Scheduler } from "../common/scheduler.interface";
import { WsEventReporter } from "./ws-event-reporter.interface";

export interface WsRouteConfiguration {
    tokenValidator: TokenValidator;
    scheduler: Scheduler;
    subjectExtractor: SubjectExtractor;
    participantResolver: ParticipantResolver;
    expirationExtractor: ExpirationExtractor;
    clock: Clock;
    wsEventReporter: WsEventReporter
}