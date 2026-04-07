import { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit"
import { IAuthenticationService } from "../authentication/IAuthenticationService";
import { ITokenGenerator } from "../authentication/ITokenGenerator";

export default async function tokenRoute(app: FastifyInstance, options: { authService: IAuthenticationService; tokenGenerator: ITokenGenerator, maxRequestsPerMinute: number }) {
    const { authService, tokenGenerator, maxRequestsPerMinute } = options;
    const schema = {
        body: {
            type: 'object',
            required: ['username', 'password'],
            properties: {
                username: { type: 'string', minLength: 1 },
                password: { type: 'string', minLength: 1 }
            },
            additionalProperties: false
        }
    };
    await app.register(rateLimit, {
        max: maxRequestsPerMinute,
        timeWindow: '1 minute'
    });
    app.post('/api/v1/token', { schema }, async (request, reply) => {
        const { username, password } = request.body as { username: string; password: string };
        const user = await authService.authenticate(username, password);
        if (!user) {
            request.log.warn({ username, ip: request.ip }, 'Authentication failed');
            return reply.status(401).send({ error: 'Invalid credentials' });
        }
        const token = tokenGenerator.generateToken(user);
        request.log.info({ username, ip: request.ip }, 'Authentication successful');
        return reply.send(token);
    });
}