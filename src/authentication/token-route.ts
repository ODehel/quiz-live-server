import Ajv from "ajv";
import { FastifyInstance } from "fastify";
import { TokenRouteConfiguration } from "./token-route-configuration.interface";

interface SchemaViolation {
    keyword: string;
    params: { additionalProperty?: string };
}

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

    const ajv = new Ajv({ allErrors: true });
    app.setValidatorCompiler(({ schema }) => ajv.compile(schema));

    app.post('/api/v1/token', { schema, attachValidation: true }, async (request, reply) => {
        if (request.validationError) {
            const violations = request.validationError.validation as SchemaViolation[];
            const unknownFields = violations
                .filter(v => v.keyword === 'additionalProperties')
                .map(v => v.params.additionalProperty);
            if (unknownFields.length > 0) {
                return reply.status(400).send({
                    status: 400,
                    error: 'UNKNOWN_FIELDS',
                    message: `Unknown field(s): ${unknownFields.join(', ')}.`
                });
            }
            return reply.send(request.validationError);
        }
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
