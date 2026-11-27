import Ajv from "ajv";
import { FastifyError, FastifyInstance } from "fastify";
import { INTERNAL_SERVER_ERROR, INVALID_CREDENTIALS, INVALID_JSON, VALIDATION_ERROR } from "../common/error-codes";
import { rejectUnsupportedContentType } from "../common/reject-unsupported-content-type";
import { TokenRouteConfiguration } from "./token-route-configuration.interface";

interface SchemaViolation {
    keyword: string;
    instancePath: string;
    params: { additionalProperty?: string; missingProperty?: string };
}

const fields = [
    { name: 'username', requiredMessage: 'Username is required.', typeMessage: 'Username must be a string.' },
    { name: 'password', requiredMessage: 'Password is required.', typeMessage: 'Password must be a string.' }
];

const notAnObjectMessage = 'Request body must be a JSON object.';

const invalidJsonBodyCodes = ['FST_ERR_CTP_INVALID_JSON_BODY', 'FST_ERR_CTP_EMPTY_JSON_BODY'];

export default function tokenRoute(app: FastifyInstance, options: TokenRouteConfiguration) {
    const { authenticationService, tokenGenerator } = options;
    const schema = {
        body: {
            type: 'object',
            required: ['username', 'password'],
            properties: {
                username: { type: ['string', 'null'], minLength: 1 },
                password: { type: ['string', 'null'], minLength: 1 }
            },
            additionalProperties: false
        }
    };

    app.removeContentTypeParser('text/plain');

    const ajv = new Ajv({ allErrors: true });
    app.setValidatorCompiler(({ schema }) => ajv.compile(schema));

    const inheritedErrorHandler = app.errorHandler;
    app.setErrorHandler<FastifyError>((error, request, reply) => {
        if (error.code && invalidJsonBodyCodes.includes(error.code)) {
            return reply.status(400).send({
                status: 400,
                error: INVALID_JSON,
                message: 'Request body must be valid JSON.'
            });
        }
        const status = (error as { status?: number }).status ?? error.statusCode;
        const isClientError = status !== undefined && status >= 400 && status < 500;
        if (!isClientError) {
            request.log.error(error);
            return reply.status(500).send({
                status: 500,
                error: INTERNAL_SERVER_ERROR,
                message: 'An unexpected error occurred. Please try again later.'
            });
        }
        return inheritedErrorHandler.call(app, error, request, reply);
    });

    app.post('/api/v1/token', { schema, attachValidation: true, onRequest: rejectUnsupportedContentType }, async (request, reply) => {
        const sendValidationError = (message: string) => reply.status(400).send({
            status: 400,
            error: VALIDATION_ERROR,
            message
        });
        const body = request.body as Record<string, unknown>;
        const isNull = (name: string) => body[name] === null;
        if (request.validationError) {
            const violations = request.validationError.validation as SchemaViolation[];
            if (violations.find(v => v.keyword === 'type' && v.instancePath === '') !== undefined) {
                return sendValidationError(notAnObjectMessage);
            }
            const mistypedField = fields.find(({ name }) => violations.some(v =>
                v.keyword === 'type' && v.instancePath === `/${name}`));
            if (mistypedField) {
                return sendValidationError(mistypedField.typeMessage);
            }
            // Past the checks above, the only violation of a field is its minLength, and only a missing field has a missingProperty.
            const missingField = fields.find(({ name }) => violations.some(v =>
                v.params.missingProperty === name
                || isNull(name)
                || v.instancePath === `/${name}`));
            if (missingField) {
                return sendValidationError(missingField.requiredMessage);
            }
            const unknownFields = violations.map(v => v.params.additionalProperty);
            return reply.status(400).send({
                status: 400,
                error: 'UNKNOWN_FIELDS',
                message: `Unknown field(s): ${unknownFields.join(', ')}.`
            });
        }
        const nullField = fields.find(({ name }) => isNull(name));
        if (nullField) {
            return sendValidationError(nullField.requiredMessage);
        }
        const { username, password } = request.body as { username: string; password: string };
        const user = await authenticationService.authenticate(username, password);
        if (!user) {
            request.log.warn({ username, ip: request.ip }, 'Authentication failed');
            return reply.status(401).send({
                status: 401,
                error: INVALID_CREDENTIALS,
                message: 'Invalid credentials.'
            });
        }
        const token = tokenGenerator.generateToken(user);
        request.log.info({ username, ip: request.ip }, 'Authentication successful');
        return reply.send({
            token: token.token,
            expires_in: token.expiresIn,
            token_type: token.tokenType
        });
    });
}
