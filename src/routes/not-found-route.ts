import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { FORBIDDEN, METHOD_NOT_ALLOWED, NOT_FOUND, UNAUTHORIZED } from "../common/error-codes";
import { ErrorBody, sendErrorBody } from "../common/send-error-body";
import { RouteCatalog } from "./route-catalog";
import { TokenValidator } from "../authentication/token-validator.interface";
import { TokenDecoder } from "../authentication/token-decoder.interface";
import { UserRole } from "../users/user-role";

const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
const SUPPORTED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

interface NotFoundRouteOptions {
    routeCatalog: RouteCatalog;
    tokenValidator: TokenValidator;
    tokenDecoder: TokenDecoder;
    publicUrls: string[];
}

export default function notFoundRoute(app: FastifyInstance, options: NotFoundRouteOptions) {
    // A method the path does not allow is answered here, before the body is read; any other request that reaches the not found handler is a 404.
    app.addHook('onRequest', async (request, reply) => {
        const path = pathOf(request);
        const allowedMethods = allowedMethodsFor(options.routeCatalog, path);
        if (allowedMethods.length === 0 || allowedMethods.includes(request.method)) {
            return;
        }
        const refusal = options.publicUrls.includes(path) ? undefined : refuseAccess(request, options);
        if (refusal) {
            sendErrorBody(reply, refusal);
        } else {
            sendMethodNotAllowed(request, reply, allowedMethods);
        }
        return reply;
    });
    app.setNotFoundHandler((_request, reply) => {
        sendErrorBody(reply, { status: 404, error: NOT_FOUND, message: 'The requested resource was not found.' });
    });
}

function pathOf(request: FastifyRequest): string {
    const queryStart = request.url.indexOf('?');
    return queryStart === -1 ? request.url : request.url.slice(0, queryStart);
}

function allowedMethodsFor(routeCatalog: RouteCatalog, path: string): string[] {
    return SUPPORTED_METHODS.filter(method => routeCatalog.methodsFor(path).includes(method));
}

function sendMethodNotAllowed(request: FastifyRequest, reply: FastifyReply, allowedMethods: string[]) {
    reply.header('Allow', allowedMethods.join(', '));
    sendErrorBody(reply, { status: 405, error: METHOD_NOT_ALLOWED, message: `HTTP method ${request.method} is not allowed on this resource.` });
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
