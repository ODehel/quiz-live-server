import { FastifyInstance } from "fastify";
import { QuestionRouteConfiguration } from "./question-route-configuration.interface";
import { CreateMcqInput } from "./create-mcq-input.interface";
import { CreateSpeedInput } from "./create-speed-input.interface";
import { Uuidv7Validator } from "../infrastructure/uuidv7-validator";
import { InvalidThemeError } from "./invalid-theme-error";
import { ValidationError } from "./validation-error";

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
            if (error instanceof InvalidThemeError) {
                reply.status(400).send({
                    status: 400,
                    error: 'INVALID_THEME',
                    message: 'The provided theme_id does not reference an existing theme.'
                });
                return;
            }

            if (error instanceof ValidationError) {
                reply.status(400).send({
                    status: 400,
                    error: 'VALIDATION_ERROR'
                });
                return;
            }
            throw error;  // laisse remonter tout le reste → 500 (comportement inchangé)
        }
    });
}
