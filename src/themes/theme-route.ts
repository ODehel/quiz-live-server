import { FastifyInstance } from "fastify";
import { ThemeService } from "./theme-service.interface";
import { ValidationError } from "./validation-error";
import { ConflictError } from "./conflict-error";
import { THEME_ALREADY_EXISTS, UNKNOWN_FIELDS, VALIDATION_ERROR } from "../common/error-codes";

export default async function themeRoute(app: FastifyInstance, options: { themeService: ThemeService }) {
    const { themeService } = options;

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

    function bodyHasUnknownFields(body: object): boolean {
        const allowedFields = ['name'];
        const unknownFields = Object.keys(body).filter(key => !allowedFields.includes(key));
        return unknownFields.length > 0;
    }
}