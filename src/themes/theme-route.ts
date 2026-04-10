import { FastifyInstance } from "fastify";
import { ThemeService } from "./theme-service.interface";

export default async function themeRoute(app: FastifyInstance, options: { themeService: ThemeService }) {
    const { themeService } = options;

    app.post('/api/v1/themes', async (request, reply) => {
        const { name } = request.body as { name: string };
        try {
            const newTheme = await themeService.createTheme(name);
            reply.status(201).send(newTheme);
        } catch (error) {
            reply.status(500).send({ error: 'Failed to create theme' });
        }
    });
}