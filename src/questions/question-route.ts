import { FastifyInstance } from "fastify";
import { QuestionRouteConfiguration } from "./question-route-configuration.interface";
import { CreateMcqInput } from "./create-mcq-input.interface";
import { CreateSpeedInput } from "./create-speed-input.interface";

export default async function questionRoute(app: FastifyInstance, options: QuestionRouteConfiguration) {
    const { questionService } = options;

    app.post('/api/v1/questions', async (request, reply) => {
        const input = request.body as CreateMcqInput | CreateSpeedInput;
        const newQuestion = questionService.createQuestion(input);
        reply.status(201).send(newQuestion);
    });
}