import { FastifyInstance } from "fastify";
import { UuidValidator } from "../common/uuid-validator.interface";
import { ThemeService } from "./theme-service.interface";
import { TokenValidator } from "../authentication/token-validator.interface";

export interface ThemeRouteConfiguration {
    themeService: ThemeService;
    uuidValidator: UuidValidator;
    tokenValidator: TokenValidator;
    middleware: (app: FastifyInstance, options: { tokenValidator: TokenValidator }) => Promise<void>;
}