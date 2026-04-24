import { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";

export default async function rateLimitMiddleware(app: FastifyInstance, options: { maxRequestsPerMinute: number }) {
    const { maxRequestsPerMinute } = options;

    await app.register(rateLimit, {
            max: maxRequestsPerMinute,
            timeWindow: '1 minute'
        });
}