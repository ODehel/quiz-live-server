import { FastifyInstance, FastifyRequest } from "fastify";
import { TokenValidator } from "./token-validator.interface";

export default async function authenticationMiddleware(app: FastifyInstance, options: { tokenValidator: TokenValidator }) {
    const { tokenValidator } = options;
    app.addHook('onRequest', async (request, reply) => {
        const token = getToken(request.headers.authorization);
        if (token === undefined || !tokenValidator.validateToken(token)) {
            reply.status(401).send();
        }
    });
}

function getToken(authorization: string | undefined): string | undefined {
    return  authorization?.substring(7);
}
