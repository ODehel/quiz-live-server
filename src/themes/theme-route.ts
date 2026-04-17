import { FastifyInstance } from "fastify";
import { ThemeService } from "./theme-service.interface";
import { ValidationError } from "./validation-error";
import { ConflictError } from "./conflict-error";
import { INVALID_PAGINATION, INVALID_UUID, THEME_ALREADY_EXISTS, THEME_NOT_FOUND, UNKNOWN_FIELDS, VALIDATION_ERROR } from "../common/error-codes";
import { UuidValidator } from "../common/uuid-validator.interface";

export default async function themeRoute(app: FastifyInstance, options: { themeService: ThemeService, uuidValidator: UuidValidator }) {
    const { themeService, uuidValidator } = options;

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
        if (bodyHasUnknownFields(request.body as object)) {
            reply.status(400).send({ error: UNKNOWN_FIELDS });
        }
        else {
            try {
                const { name } = request.body as { name: string };
                const newTheme = themeService.createTheme(name);
                reply.status(201).send(newTheme);
            } catch (error) {
                if (error instanceof ValidationError) {
                    reply.status(400).send({ error: VALIDATION_ERROR });
                } else if (error instanceof ConflictError) {
                    reply.status(409).send({ error: THEME_ALREADY_EXISTS });
                } else {
                    reply.status(500).send({ error: 'Failed to create theme' });
                }
            }
        }
    });

    app.put('/api/v1/themes/:id', async (request, reply) => {
        try {
            const { id } = request.params as { id: string };
            const { name } = request.body as { name: string };
            const updatedTheme = themeService.updateTheme(id, name);
            reply.status(200).send(updatedTheme);
        } catch (error) {
            reply.status(500).send({ error: 'Failed to update theme' });
        }
    });

    function paginationParametersAreInvalid(limit: number, page: number) {
        return (limit > 100 || limit <= 0) || (isNaN(limit) || isNaN(page)) || page <= 0;
    }

    function bodyHasUnknownFields(body: object): boolean {
        const allowedFields = ['name'];
        const unknownFields = Object.keys(body).filter(key => !allowedFields.includes(key));
        return unknownFields.length > 0;
    }
}