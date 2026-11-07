import { FastifyInstance } from "fastify";
import { TokenValidator } from "./token-validator.interface";
import { TokenDecoder } from "./token-decoder.interface";
import { UserRole } from "../users/user-role";
import { FORBIDDEN, UNAUTHORIZED } from "../common/error-codes";
import { sendErrorBody } from "../common/send-error-body";

export default function authenticationMiddleware(app: FastifyInstance, options: { tokenValidator: TokenValidator, tokenDecoder: TokenDecoder }) {
    const { tokenValidator, tokenDecoder } = options;
    app.addHook('onRequest', async (request, reply) => {
        const token = getToken(request.headers.authorization);
        if (token === undefined || !tokenValidator.validateToken(token)) {
            sendErrorBody(reply, {
                status: 401,
                error: UNAUTHORIZED,
                message: 'Authentication token is missing or invalid.'
            });
        } else {
            const decodedToken = tokenDecoder.decode(token);
            if (!decodedToken || decodedToken.role !== UserRole.ADMIN) {
                sendErrorBody(reply, {
                    status: 403,
                    error: FORBIDDEN,
                    message: 'You do not have permission to perform this action.'
                });
            }
        }
    });
}

function getToken(authorization: string | undefined): string | undefined {
    return  authorization?.substring(7);
}
