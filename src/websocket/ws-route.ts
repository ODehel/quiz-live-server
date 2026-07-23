import { FastifyInstance } from "fastify";
import '@fastify/websocket';
import { WsRouteConfiguration } from "./ws-route-configuration.interface";
import { toRoleLabel } from "../users/role-label";

const WS_CLOSE_INVALID_TOKEN = { code: 4001, reason: "Invalid token." } as const;
const WS_CLOSE_TOKEN_EXPIRED = { code: 4002, reason: "Token expired." } as const;
const WS_CLOSE_AUTH_TIMEOUT = { code: 4003, reason: "Authentication timeout." } as const;

const AUTH_TIMEOUT_WS = 60_000;

export default async function wsRoute(app: FastifyInstance, config: WsRouteConfiguration) {
    app.get('/ws', { websocket: true }, async (socket) => {
        config.wsEventReporter.connected();
        let schedulerCallback = () => {
            socket.close(WS_CLOSE_AUTH_TIMEOUT.code, WS_CLOSE_AUTH_TIMEOUT.reason);
        };
        const handle = config.scheduler.schedule(schedulerCallback, AUTH_TIMEOUT_WS);
        socket.on('message', async (data) => {
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
            const subject = config.subjectExtractor.extract(message.token);
            const participant = await config.participantResolver.resolve(subject);
            if (participant === null) {
                socket.close(WS_CLOSE_INVALID_TOKEN.code, WS_CLOSE_INVALID_TOKEN.reason);
                return;
            }
            const expiration = config.expirationExtractor.extract(message.token);
            const now = config.clock.now().getTime() / 1000;
            const expiresIn = Math.floor(expiration - now);
            socket.send(JSON.stringify({
                type: "auth_success",
                username: participant.username,
                role: toRoleLabel(participant.role),
                expires_in: expiresIn
            }));
        });
    });
}