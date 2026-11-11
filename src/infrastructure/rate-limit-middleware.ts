import { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { RATE_LIMIT_EXCEEDED } from "../common/error-codes";

const RETRY_AFTER_SECONDS = 60;

export default async function rateLimitMiddleware(app: FastifyInstance, options: { maxRequestsPerMinute: number }) {
    const { maxRequestsPerMinute } = options;

    await app.register(rateLimit, {
        max: maxRequestsPerMinute,
        timeWindow: '1 minute',
        errorResponseBuilder: (_request, context) => {
            return { status: context.statusCode, error: RATE_LIMIT_EXCEEDED, message: `Too many requests. Please retry in ${RETRY_AFTER_SECONDS} seconds.` };
        }
    });

    app.addHook('onSend', async (_request, reply) => {
        if (reply.statusCode === 429) {
            reply.header('retry-after', String(RETRY_AFTER_SECONDS));
        }
    });
}
