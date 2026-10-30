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

type SchemaViolation = { keyword: string, instancePath: string, params: { missingProperty?: string, additionalProperty?: string } };

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
                    title: { type: 'string' },
                    correct_answer: { type: 'string' },
                    choices: {},
                    level: {},
                    time_limit: {},
                    points: {}
                },
                if: { properties: { type: { const: 'MCQ' } }, required: ['type'] },
                then: { required: ['choices'], properties: { choices: { type: 'array', items: { type: 'string' } } } },
                required: ['theme_id', 'title', 'type', 'level', 'time_limit', 'points', 'correct_answer'],
                additionalProperties: false
            }
        }
    }, async (request, reply) => {

        if (request.validationError) {
            const violations = request.validationError.validation as SchemaViolation[];
            if (violations.some(v => v.keyword === 'type')) {
                if (violations.some(v => v.keyword === 'type' && v.instancePath === '/correct_answer')) {
                    sendCorrectAnswerNotAString(reply);
                } else if (violations.some(v => v.keyword === 'type' && v.instancePath.startsWith('/choices/'))) {
                    sendChoicesNotOnlyStrings(reply);
                } else if (violations.some(v => v.keyword === 'type' && v.instancePath === '/choices')) {
                    sendChoicesNotAnArray(reply);
                } else if (violations.some(v => v.keyword === 'type' && v.instancePath === '/title')) {
                    sendTitleNotAString(reply);
                } else if (violations.some(v => v.keyword === 'type' && v.instancePath === '')) {
                    sendInvalidBody(reply);
                } else {
                    const uncaughtViolations = violations.filter(v => v.keyword === 'type').map(v => v.instancePath);
                    throw new Error(`No branch handles the type violation at: ${uncaughtViolations.join(', ')}`);
                }
                return;
            }

            const missingFields = violations
                .filter(v => v.keyword === 'required')
                .map(v => v.params.missingProperty)
                .filter((f): f is string => f !== undefined);

            if (missingFields.length > 0) {
                sendMissingFields(reply, missingFields);
                return;
            }

            const unknownFields = violations.map(v => v.params.additionalProperty).join(', ');
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

    app.get('/api/v1/questions', async (request, reply) => {
        const { page = 1, limit = 20 } = request.query as { page?: number, limit?: number };

        if (!/^[1-9][0-9]*$/.test(String(limit)) || limit > 100 || !/^[1-9][0-9]*$/.test(String(page))) {
            sendInvalidPaginationParameters(reply);
            return;
        }

        try {
            const pagination = questionService.getAll(Number(page), Number(limit));
            reply.status(200).send(pagination);
        } catch (error) {
            sendError(error, reply);
        }
    });

    function sendMissingFields(reply: FastifyReply, missingFields: string[]) {
        const missingFieldsList = missingFields.join(', ');
        const verb = missingFields.length > 1 ? 'are' : 'is';

        sendErrorBody(reply, {
            status: 400,
            error: 'VALIDATION_ERROR',
            message: `Question ${missingFieldsList} ${verb} required.`
        });
    }

    function sendChoicesNotOnlyStrings(reply: FastifyReply) {
        sendErrorBody(reply, {
            status: 400,
            error: 'VALIDATION_ERROR',
            message: 'Question choices must contain only strings.'
        });
    }

    function sendChoicesNotAnArray(reply: FastifyReply) {
        sendErrorBody(reply, {
            status: 400,
            error: 'VALIDATION_ERROR',
            message: 'Question choices must be an array.'
        });
    }

    function sendCorrectAnswerNotAString(reply: FastifyReply) {
        sendErrorBody(reply, {
            status: 400,
            error: 'VALIDATION_ERROR',
            message: 'Question correct_answer must be a string.'
        });
    }

    function sendTitleNotAString(reply: FastifyReply) {
        sendErrorBody(reply, {
            status: 400,
            error: 'VALIDATION_ERROR',
            message: 'Question title must be a string.'
        });
    }

    function sendInvalidPaginationParameters(reply: FastifyReply) {
        sendErrorBody(reply, {
            status: 400,
            error: 'INVALID_PAGINATION',
            message: 'Invalid pagination parameters.'
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
