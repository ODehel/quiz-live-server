import { FastifyInstance } from "fastify";
import { UuidValidator } from "../common/uuid-validator.interface";
import { TokenDecoder } from "../authentication/token-decoder.interface";
import { TokenValidator } from "../authentication/token-validator.interface";
import { QuestionService } from "./question-service.interface";

export interface QuestionRouteConfiguration {
    questionService: QuestionService;
    uuidValidator: UuidValidator;
    tokenValidator: TokenValidator;
    tokenDecoder: TokenDecoder;
    middleware: (app: FastifyInstance, options: { tokenValidator: TokenValidator, tokenDecoder: TokenDecoder }) => void | Promise<void>;
}
