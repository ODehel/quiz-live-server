import { FastifyInstance } from "fastify";
import { QuestionRouteConfiguration } from "./question-route-configuration.interface";
import { CreateMcqInput } from "./create-mcq-input.interface";
import { CreateSpeedInput } from "./create-speed-input.interface";
import { Uuidv7Validator } from "../infrastructure/uuidv7-validator";

export default async function questionRoute(app: FastifyInstance, options: QuestionRouteConfiguration) {
    const { questionService } = options;

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
        const created = questionService.createQuestion(input);
        reply.status(201).send(created);
    });
}