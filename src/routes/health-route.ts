import { FastifyInstance } from "fastify";

export default function healthRoute(app: FastifyInstance) {
    app.get('/health', () => {
        return { status: 'ok' }
    });
}
