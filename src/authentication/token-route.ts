import { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { TokenRouteConfiguration } from "./token-route-configuration.interface";

export default async function tokenRoute(app: FastifyInstance, options: TokenRouteConfiguration) {
    const { authenticationService, tokenGenerator, rateLimitMiddleware } = options;
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
    
    await rateLimitMiddleware(app);

    app.post('/api/v1/token', { schema }, async (request, reply) => {
        const { username, password } = request.body as { username: string; password: string };
        const user = await authenticationService.authenticate(username, password);
        if (!user) {
            request.log.warn({ username, ip: request.ip }, 'Authentication failed');
            return reply.status(401).send({ error: 'Invalid credentials' });
        }
        const token = tokenGenerator.generateToken(user);
        request.log.info({ username, ip: request.ip }, 'Authentication successful');
        return reply.send(token);
    });
}