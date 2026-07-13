import { FastifyInstance } from "fastify";
import '@fastify/websocket';

export default async function wsRoute(app: FastifyInstance) {
    app.get('/ws', { websocket: true }, (socket, req) => {
        socket.on('message', () => {
            socket.send("pong");
        });
    });
}