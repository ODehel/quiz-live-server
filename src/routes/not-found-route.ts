import { FastifyInstance } from "fastify";
import { NOT_FOUND } from "../common/error-codes";
import { sendErrorBody } from "../common/send-error-body";

export default async function notFoundRoute(app: FastifyInstance, options: { rateLimitMiddleware: (app: FastifyInstance) => Promise<void> }) {
    await options.rateLimitMiddleware(app);
    app.setNotFoundHandler({ preHandler: app.rateLimit() }, (_request, reply) => {
        sendErrorBody(reply, { status: 404, error: NOT_FOUND, message: 'The requested resource was not found.' });
    });
}
