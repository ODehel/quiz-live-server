import { FastifyInstance, FastifyRequest } from "fastify";
import { TokenValidator } from "./token-validator.interface";
import { TokenDecoder } from "./token-decoder.interface";
import { UserRole } from "../users/user-role";

export default async function authenticationMiddleware(app: FastifyInstance, options: { tokenValidator: TokenValidator, tokenDecoder: TokenDecoder }) {
    const { tokenValidator, tokenDecoder } = options;
    app.addHook('onRequest', async (request, reply) => {
        const token = getToken(request.headers.authorization);
        if (token === undefined || !tokenValidator.validateToken(token)) {
            reply.status(401).send();
        } else {
            const decodedToken = tokenDecoder.decode(token);
            if (!decodedToken || decodedToken.role !== UserRole.ADMIN) {
                reply.status(403).send();
            }
        }
    });
}

function getToken(authorization: string | undefined): string | undefined {
    return  authorization?.substring(7);
}
