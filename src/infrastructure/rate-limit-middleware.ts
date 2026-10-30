import { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { RATE_LIMIT_EXCEEDED } from "../common/error-codes";

export default async function rateLimitMiddleware(app: FastifyInstance, options: { maxRequestsPerMinute: number }) {
    const { maxRequestsPerMinute } = options;

    await app.register(rateLimit, {
        max: maxRequestsPerMinute,
        timeWindow: '1 minute',
        errorResponseBuilder: (_request, context) => {
            return { status: context.statusCode, error: RATE_LIMIT_EXCEEDED, message: 'Too many requests. Please retry in 60 seconds.' };
        }
    });
}
