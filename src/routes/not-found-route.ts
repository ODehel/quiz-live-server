import { FastifyInstance, FastifyRequest } from "fastify";
import { FORBIDDEN, METHOD_NOT_ALLOWED, NOT_FOUND, UNAUTHORIZED } from "../common/error-codes";
import { ErrorBody, sendErrorBody } from "../common/send-error-body";
import { RouteCatalog } from "./route-catalog";
import { TokenValidator } from "../authentication/token-validator.interface";
import { TokenDecoder } from "../authentication/token-decoder.interface";
import { UserRole } from "../users/user-role";

const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
const SUPPORTED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

interface NotFoundRouteOptions {
    rateLimitMiddleware: (app: FastifyInstance) => Promise<void>;
    routeCatalog: RouteCatalog;
    tokenValidator: TokenValidator;
    tokenDecoder: TokenDecoder;
    publicUrls: string[];
}

export default async function notFoundRoute(app: FastifyInstance, options: NotFoundRouteOptions) {
    await options.rateLimitMiddleware(app);
    app.setNotFoundHandler({ preHandler: app.rateLimit() }, (request, reply) => {
        const [path = ''] = request.url.split('?');
        const allowedMethods = SUPPORTED_METHODS.filter(method => options.routeCatalog.methodsFor(path).includes(method));
        if (allowedMethods.length === 0) {
            sendErrorBody(reply, { status: 404, error: NOT_FOUND, message: 'The requested resource was not found.' });
            return;
        }
        const refusal = options.publicUrls.includes(path) ? undefined : refuseAccess(request, options);
        if (refusal) {
            sendErrorBody(reply, refusal);
            return;
        }
        reply.header('Allow', allowedMethods.join(', '));
        sendErrorBody(reply, { status: 405, error: METHOD_NOT_ALLOWED, message: `HTTP method ${request.method} is not allowed on this resource.` });
    });
}

function refuseAccess(request: FastifyRequest, options: NotFoundRouteOptions): ErrorBody | undefined {
    const token = request.headers.authorization?.substring(7);
    if (token === undefined || !options.tokenValidator.validateToken(token)) {
        return { status: 401, error: UNAUTHORIZED, message: 'Authentication token is missing or invalid.' };
    }
    const decodedToken = options.tokenDecoder.decode(token);
    if (WRITE_METHODS.includes(request.method) && (!decodedToken || decodedToken.role !== UserRole.ADMIN)) {
        return { status: 403, error: FORBIDDEN, message: 'You do not have permission to perform this action.' };
    }
    return undefined;
}
