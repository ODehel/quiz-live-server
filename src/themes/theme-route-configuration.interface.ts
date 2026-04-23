import { FastifyInstance } from "fastify";
import { UuidValidator } from "../common/uuid-validator.interface";
import { ThemeService } from "./theme-service.interface";
import { TokenValidator } from "../authentication/token-validator.interface";
import { TokenDecoder } from "../authentication/token-decoder.interface";

export interface ThemeRouteConfiguration {
    themeService: ThemeService;
    uuidValidator: UuidValidator;
    tokenValidator: TokenValidator;
    tokenDecoder: TokenDecoder;
    middleware: (app: FastifyInstance, options: { tokenValidator: TokenValidator, tokenDecoder: TokenDecoder }) => Promise<void>;
    maxRequestsPerMinute: number;
}