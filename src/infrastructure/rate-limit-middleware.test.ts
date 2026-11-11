import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import rateLimitMiddleware from "./rate-limit-middleware";

describe("US-005/CA-52 (decision #36) - a rate limited request always answers Retry-After 60", () => {
    let app: FastifyInstance;
    beforeEach(async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        app = Fastify();
        await rateLimitMiddleware(app, { maxRequestsPerMinute: 1 });
        app.get('/limited', () => ({ ok: true }));
        await app.ready();
    });
    afterEach(async () => {
        await app.close();
        vi.useRealTimers();
    });
    it('should answer Retry-After 60 to the first request refused in the window', async () => {
        await app.inject({ method: 'GET', url: '/limited' });
        const refused = await app.inject({ method: 'GET', url: '/limited' });
        expect(refused.statusCode).toBe(429);
        expect(refused.headers['retry-after']).toBe('60');
    });
    it('should still answer Retry-After 60 to a request refused 3 seconds later in the same window', async () => {
        await app.inject({ method: 'GET', url: '/limited' });
        vi.advanceTimersByTime(3000);
        const refused = await app.inject({ method: 'GET', url: '/limited' });
        expect(refused.statusCode).toBe(429);
        expect(refused.headers['retry-after']).toBe('60');
    });
});
