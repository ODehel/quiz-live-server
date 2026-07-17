import { TokenValidator } from "../authentication/token-validator.interface";
import { Scheduler } from "../common/scheduler.interface";

export interface WsRouteConfiguration {
    tokenValidator: TokenValidator;
    scheduler: Scheduler;
}