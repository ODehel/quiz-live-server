import { FastifyInstance } from "fastify";
import { AuthenticationService } from "./authentication-service.interface";
import { TokenGenerator } from "./token-generator.interface";

export interface TokenRouteConfiguration {
    authenticationService: AuthenticationService;
    tokenGenerator: TokenGenerator;
    rateLimitMiddleware: (app: FastifyInstance) => Promise<void>;
}