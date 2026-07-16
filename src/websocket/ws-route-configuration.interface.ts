import { TokenValidator } from "../authentication/token-validator.interface";

export interface WsRouteConfiguration {
    tokenValidator: TokenValidator;
}