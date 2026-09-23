import { FastifyInstance, FastifyReply } from "fastify";
import { QuestionRouteConfiguration } from "./question-route-configuration.interface";
import { CreateMcqInput } from "./create-mcq-input.interface";
import { CreateSpeedInput } from "./create-speed-input.interface";
import { Uuidv7Validator } from "../infrastructure/uuidv7-validator";
import { InvalidThemeError } from "./invalid-theme-error";
import { ValidationError } from "./validation-error";
import { ConflictError } from "./conflict-error";

export default async function questionRoute(app: FastifyInstance, options: QuestionRouteConfiguration) {
    const { questionService, tokenValidator, tokenDecoder, middleware } = options;

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

    function sendError(error: unknown, reply: FastifyReply) {
        if (error instanceof ConflictError) {
            reply.status(409).send({
                status: 409,
                error: 'QUESTION_ALREADY_EXISTS',
                message: 'A question with this title already exists.'
            });
        } else if (error instanceof InvalidThemeError) {
            reply.status(400).send({
                status: 400,
                error: 'INVALID_THEME',
                message: 'The provided theme_id does not reference an existing theme.'
            });
        } else if (error instanceof ValidationError) {
            reply.status(400).send({
                status: 400,
                error: 'VALIDATION_ERROR'
            });
        } else {
            throw error;
        }
    }
}
