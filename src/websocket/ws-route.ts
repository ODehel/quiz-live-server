import { FastifyInstance } from "fastify";
import '@fastify/websocket';

export default async function wsRoute(app: FastifyInstance) {
    app.get('/ws', { websocket: true }, (socket, req) => {
        socket.on('message', (data, isBinary) => {
            try {
                JSON.parse(data.toString());
            } catch {
                socket.close(4001, "Invalid token.");
                return;
            }
            socket.send(JSON.stringify({ type: "auth_success" }));
        });
    });
}