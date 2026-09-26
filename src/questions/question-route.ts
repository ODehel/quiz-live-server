import { FastifyInstance, FastifyReply } from "fastify";
import { QuestionRouteConfiguration } from "./question-route-configuration.interface";
import { CreateMcqInput } from "./create-mcq-input.interface";
import { CreateSpeedInput } from "./create-speed-input.interface";
import { Uuidv7Validator } from "../infrastructure/uuidv7-validator";
import { InvalidThemeError } from "./invalid-theme-error";
import { ValidationError } from "./validation-error";
import { ConflictError } from "./conflict-error";
import { NotFoundError } from "../common/not-found-error";
import { UuidFormatValidator } from "../infrastructure/uuid-format-validator";

interface ErrorBody {
    status: number;
    error: string;
    message?: string;
}

export default async function questionRoute(app: FastifyInstance, options: QuestionRouteConfiguration) {
    const { questionService, tokenValidator, tokenDecoder, middleware, rateLimitMiddleware } = options;

    await rateLimitMiddleware(app);

    await middleware(app, { tokenValidator: tokenValidator, tokenDecoder: tokenDecoder });

    app.post('/api/v1/questions', async (request, reply) => {
        const input = request.body as CreateMcqInput | CreateSpeedInput;

        if (input.type !== 'MCQ' && input.type !== 'SPEED') {
            reply.status(400).send();
            return;
        }

        if (!new Uuidv7Validator().validate(input.theme_id)) {
            reply.status(400).send();
            return;
        }

        try {
            const created = questionService.createQuestion(input);
            reply.status(201).send(created);
        } catch (error) {
            sendError(error, reply);
        }
    });

    app.get('/api/v1/questions/:id', async (request, reply) => {
        const { id } = request.params as { id: string };

        if (!new UuidFormatValidator().validate(id)) {
            sendErrorBody(reply, {
                status: 400,
                error: 'INVALID_UUID',
                message: 'The provided ID is not a valid UUID.'
            });
            return;
        }

        try {
            const question = questionService.getQuestionById(id);
            reply.status(200).send(question);
        } catch (error) {
            if (error instanceof NotFoundError) {
                sendErrorBody(reply, {
                    status: 404,
                    error: 'NOT_FOUND',
                    message: 'The requested question was not found.'
                });
            } else {
                throw error;
            }
        }
    });

    function sendError(error: unknown, reply: FastifyReply) {
        if (error instanceof ConflictError) {
            sendErrorBody(reply, {
                status: 409,
                error: 'QUESTION_ALREADY_EXISTS',
                message: 'A question with this title already exists.'
            });
        } else if (error instanceof InvalidThemeError) {
            sendErrorBody(reply, {
                status: 400,
                error: 'INVALID_THEME',
                message: 'The provided theme_id does not reference an existing theme.'
            });
        } else if (error instanceof ValidationError) {
            sendErrorBody(reply, {
                status: 400,
                error: 'VALIDATION_ERROR'
            });
        } else {
            reply.log.error(error);
            sendErrorBody(reply, {
                status: 500,
                error: 'INTERNAL_SERVER_ERROR',
                message: 'An unexpected error occurred. Please try again later.'
            });
        }
    }

    function sendErrorBody(reply: FastifyReply, body: ErrorBody) {
        reply.status(body.status).send(body);
    }
}
