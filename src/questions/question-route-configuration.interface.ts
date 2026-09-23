import { FastifyInstance } from "fastify";
import { TokenDecoder } from "../authentication/token-decoder.interface";
import { TokenValidator } from "../authentication/token-validator.interface";
import { QuestionService } from "./question-service.interface";

export interface QuestionRouteConfiguration {
    questionService: QuestionService;
    tokenValidator: TokenValidator;
    tokenDecoder: TokenDecoder;
    middleware: (app: FastifyInstance, options: { tokenValidator: TokenValidator, tokenDecoder: TokenDecoder }) => Promise<void>;
}
