import { FastifyInstance } from "fastify";
import '@fastify/websocket';
import { WsRouteConfiguration } from "./ws-route-configuration.interface";

const WS_CLOSE_INVALID_TOKEN = { code: 4001, reason: "Invalid token." } as const;
const WS_CLOSE_TOKEN_EXPIRED = { code: 4002, reason: "Token expired." } as const;
const WS_CLOSE_AUTH_TIMEOUT = { code: 4003, reason: "Authentication timeout." } as const;

const AUTH_TIMEOUT_WS = 60_000;

export default async function wsRoute(app: FastifyInstance, config: WsRouteConfiguration) {
    app.get('/ws', { websocket: true }, (socket) => {
        let schedulerCallback = () => {
            socket.close(WS_CLOSE_AUTH_TIMEOUT.code, WS_CLOSE_AUTH_TIMEOUT.reason);
        };
        const handle = config.scheduler.schedule(schedulerCallback, AUTH_TIMEOUT_WS);
        socket.on('message', (data) => {
            handle.cancel();
            let message: { type?: string, token?: string };
            try {
                message = JSON.parse(data.toString());
            } catch {
                socket.close(WS_CLOSE_INVALID_TOKEN.code, WS_CLOSE_INVALID_TOKEN.reason);
                return;
            }
            if (message.type !== "auth") {
                socket.close(WS_CLOSE_INVALID_TOKEN.code, WS_CLOSE_INVALID_TOKEN.reason);
                return;
            }
            if (message.token === undefined) {
                socket.close(WS_CLOSE_INVALID_TOKEN.code, WS_CLOSE_INVALID_TOKEN.reason);
                return;
            }
            const inspection = config.tokenValidator.inspectToken(message.token);
            if (inspection.reason === "expired") {
                socket.close(WS_CLOSE_TOKEN_EXPIRED.code, WS_CLOSE_TOKEN_EXPIRED.reason);
                return;
            }
            if (!inspection.valid) {
                socket.close(WS_CLOSE_INVALID_TOKEN.code, WS_CLOSE_INVALID_TOKEN.reason);
                return;
            }
            socket.send(JSON.stringify({ type: "auth_success" }));
        });
    });
}