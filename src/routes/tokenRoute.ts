import { FastifyInstance } from "fastify";
import { IAuthenticationService } from "../authentication/IAuthenticationService";
import { ITokenGenerator } from "../authentication/ITokenGenerator";

export default async function tokenRoute(app: FastifyInstance, options: { authService: IAuthenticationService; tokenGenerator: ITokenGenerator }) {
    const { authService, tokenGenerator } = options;
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
    app.post('/api/v1/token', { schema }, async (request, reply) => {
        const { username, password } = request.body as { username: string; password: string }
        const user = await authService.authenticate(username, password)
        if (!user) {
            return reply.status(401).send({ error: 'Invalid credentials' })
        }
        const token = tokenGenerator.generateToken(user)
        return reply.send({ token })
    });
}