import { FastifyInstance, FastifyReply } from "fastify";
import { QuestionRouteConfiguration } from "./question-route-configuration.interface";
import { CreateMcqInput } from "./create-mcq-input.interface";
import { CreateSpeedInput } from "./create-speed-input.interface";
import { InvalidThemeError } from "./invalid-theme-error";
import { ValidationError } from "./validation-error";
import { ConflictError } from "./conflict-error";
import { NotFoundError } from "../common/not-found-error";
import { UuidFormatValidator } from "../infrastructure/uuid-format-validator";
import Ajv from "ajv";

interface ErrorBody {
    status: number;
    error: string;
    message?: string;
}

export default async function questionRoute(app: FastifyInstance, options: QuestionRouteConfiguration) {
    const { questionService, tokenValidator, tokenDecoder, middleware, rateLimitMiddleware } = options;

    await rateLimitMiddleware(app);

    await middleware(app, { tokenValidator: tokenValidator, tokenDecoder: tokenDecoder });

    const ajv = new Ajv({ allErrors: true });
    app.setValidatorCompiler(({ schema }) => ajv.compile(schema));

    app.post('/api/v1/questions', {
        attachValidation: true,
        schema: {
            body: {
                type: 'object',
                properties: {
                    type: {},
                    theme_id: {},
                    title: {},
                    correct_answer: {},
                    choices: {},
                    level: {},
                    time_limit: {},
                    points: {}
                },
                required: ['title'],
                additionalProperties: false
            }
        }
    }, async (request, reply) => {

        if (request.validationError) {
            if (request.validationError.validation.some((v: { keyword: string }) => v.keyword === 'type')) {
                sendInvalidBody(reply);
                return;
            }

            if (request.validationError.validation.some((v: { keyword: string, params: { missingProperty: string } }) => v.keyword === 'required' && v.params.missingProperty === 'title')) {
                sendMissingTitle(reply);
                return;
            }

            const unknownFields = request.validationError.validation.map((v: { params: { additionalProperty: string } }) => v.params.additionalProperty).join(', ');
            sendUnknownFields(reply, unknownFields);
            return;
        }

        const input = request.body as CreateMcqInput | CreateSpeedInput;

        if (!new UuidFormatValidator().validate(input.theme_id)) {
            sendInvalidUuid(reply);
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
            sendInvalidUuid(reply);
            return;
        }

        try {
            const question = questionService.getQuestionById(id);
            reply.status(200).send(question);
        } catch (error) {
            sendError(error, reply);
        }
    });

    function sendMissingTitle(reply: FastifyReply) {
        sendErrorBody(reply, {
            status: 400,
            error: 'VALIDATION_ERROR',
            message: 'Question title is required.'
        });
    }

    function sendInvalidBody(reply: FastifyReply) {
        sendErrorBody(reply, {
            status: 400,
            error: 'INVALID_BODY',
            message: 'Request body must be a JSON object.'
        });
    }

    function sendError(error: unknown, reply: FastifyReply) {
        if (error instanceof InvalidThemeError) {
            sendErrorBody(reply, {
                status: 400,
                error: 'INVALID_THEME',
                message: 'The provided theme_id does not reference an existing theme.'
            });
        } else if (error instanceof ValidationError) {
            sendErrorBody(reply, {
                status: 400,
                error: 'VALIDATION_ERROR',
                message: error.message
            });
        } else if (error instanceof NotFoundError) {
            sendErrorBody(reply, {
                status: 404,
                error: 'NOT_FOUND',
                message: 'The requested question was not found.'
            });
        } else if (error instanceof ConflictError) {
            sendErrorBody(reply, {
                status: 409,
                error: 'QUESTION_ALREADY_EXISTS',
                message: 'A question with this title already exists.'
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

    function sendInvalidUuid(reply: FastifyReply) {
        sendErrorBody(reply, {
            status: 400,
            error: 'INVALID_UUID',
            message: 'The provided ID is not a valid UUID.'
        });
    }

    function sendUnknownFields(reply: FastifyReply, unknownFields: string) {
        sendErrorBody(reply, {
            status: 400,
            error: 'UNKNOWN_FIELDS',
            message: `Unknown field(s): ${unknownFields}.`
        });
    }

    function sendErrorBody(reply: FastifyReply, body: ErrorBody) {
        reply.status(body.status).send(body);
    }
}
