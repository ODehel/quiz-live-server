import { FastifyInstance, FastifyReply } from "fastify";
import rateLimit from "@fastify/rate-limit"
import { ValidationError } from "./validation-error";
import { ConflictError } from "./conflict-error";
import { ID_MISMATCH, INVALID_PAGINATION, INVALID_UUID, THEME_ALREADY_EXISTS, THEME_HAS_QUESTIONS, THEME_NOT_FOUND, UNKNOWN_FIELDS, VALIDATION_ERROR } from "../common/error-codes";
import { ThemeNotFoundError } from "./theme-not-found-error";
import { ThemeHasQuestionsError } from "./theme-has-questions-error";
import { ThemeRouteConfiguration } from "./theme-route-configuration.interface";

export default async function themeRoute(app: FastifyInstance, options: ThemeRouteConfiguration) {
    const { themeService, uuidValidator, tokenValidator, tokenDecoder, middleware, maxRequestsPerMinute } = options;

    await app.register(rateLimit, {
        max: maxRequestsPerMinute,
        timeWindow: '1 minute'
    });

    await middleware(app, { tokenValidator: tokenValidator, tokenDecoder: tokenDecoder });

    app.get('/api/v1/themes/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        if (!uuidValidator.validate(id)) {
            reply.status(400).send({ error: INVALID_UUID });
            return;
        }
        const existingTheme = themeService.getById(id);
        if (existingTheme === undefined) {
            reply.status(404).send({ error: THEME_NOT_FOUND });
        } else {
            reply.status(200).send(existingTheme);
        }
    });

    app.get('/api/v1/themes', async (request, reply) => {
        const { page = 1, limit = 20 } = request.query as { page?: number, limit?: number };

        if (paginationParametersAreInvalid(limit, page)) {
            reply.status(400).send({ error: INVALID_PAGINATION });
            return;
        }

        const pagination = themeService.getAll(page, limit);
        reply.status(200).send(pagination);
    });

    app.post('/api/v1/themes', async (request, reply) => {
        if (bodyHasUnknownFields(request.body as object, ['name'])) {
            reply.status(400).send({ error: UNKNOWN_FIELDS });
        }
        else {
            try {
                const { name } = request.body as { name: string };
                const newTheme = themeService.createTheme(name);
                reply.status(201).send(newTheme);
            } catch (error) {
                sendError(error, 'Failed to create theme', reply);
            }
        }
    });

    app.put('/api/v1/themes/:id', async (request, reply) => {
        if (bodyHasUnknownFields(request.body as object, ['id', 'name'])) {
            reply.status(400).send({ error: UNKNOWN_FIELDS });
        }
        else {
            try {
                const { id: idFromParams } = request.params as { id: string };
                const { id: idFromBody, name } = request.body as { id?: string, name: string };

                if (idFromBody !== undefined && idFromParams !== idFromBody) {
                    reply.status(400).send({ error: ID_MISMATCH });
                    return;
                }
                const updatedTheme = themeService.updateTheme(idFromParams, name);
                reply.status(200).send(updatedTheme);
            } catch (error) {
                if (error instanceof ThemeNotFoundError) {
                    reply.status(404).send({ error: THEME_NOT_FOUND });
                } else {
                    sendError(error, 'Failed to update theme', reply);
                }
            }
        }
    });

    app.register(async (instance) => {
        instance.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, _body, done) => {
            done(null, null);
        });
        instance.delete('/api/v1/themes/:id', async (request, reply) => {
            const { id } = request.params as { id: string };

            try {
                themeService.deleteTheme(id);
                reply.status(204).send();
            } catch (error) {
                if (error instanceof ThemeNotFoundError) {
                    reply.status(404).send({ error: THEME_NOT_FOUND });
                } else if (error instanceof ThemeHasQuestionsError) {
                    reply.status(409).send({ error: THEME_HAS_QUESTIONS });
                } else {
                    reply.status(500).send({ error: 'Failed to delete theme' });
                }
            }
        });
    });

    function sendError(error: unknown, error500message: string, reply: FastifyReply) {
        if (error instanceof ValidationError) {
            reply.status(400).send({ error: VALIDATION_ERROR });
        } else if (error instanceof ConflictError) {
            reply.status(409).send({ error: THEME_ALREADY_EXISTS });
        } else {
            reply.status(500).send({ error: error500message });
        }
    }

    function paginationParametersAreInvalid(limit: number, page: number) {
        return (limit > 100 || limit <= 0) || (isNaN(limit) || isNaN(page)) || page <= 0;
    }

    function bodyHasUnknownFields(body: object, allowedFields: string[]): boolean {
        const unknownFields = Object.keys(body).filter(key => !allowedFields.includes(key));
        return unknownFields.length > 0;
    }
}