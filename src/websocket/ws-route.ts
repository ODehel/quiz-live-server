import { FastifyInstance } from "fastify";
import '@fastify/websocket';

const WS_CLOSE_INVALID_TOKEN: {code: number, reason: string} = {code: 4001, reason: "Invalid token."} as const;

export default async function wsRoute(app: FastifyInstance) {
    app.get('/ws', { websocket: true }, (socket) => {
        socket.on('message', (data) => {
            let message: { token?: string };
            try {
                message = JSON.parse(data.toString());
            } catch {
                socket.close(WS_CLOSE_INVALID_TOKEN.code, WS_CLOSE_INVALID_TOKEN.reason);
                return;
            }
            if (message.token === undefined) {
                socket.close(WS_CLOSE_INVALID_TOKEN.code, WS_CLOSE_INVALID_TOKEN.reason);
                return;
            }
            socket.send(JSON.stringify({ type: "auth_success" }));
        });
    });
}