import { FastifyInstance } from "fastify";
import '@fastify/websocket';
import { WsRouteConfiguration } from "./ws-route-configuration.interface";
import { toRoleLabel } from "../users/role-label";
import { WebSocket } from "ws";
import { UserRole } from "../users/user-role";

const WS_CLOSE_INVALID_TOKEN = { code: 4001, reason: "Invalid token." } as const;
const WS_CLOSE_TOKEN_EXPIRED = { code: 4002, reason: "Token expired." } as const;
const WS_CLOSE_AUTH_TIMEOUT = { code: 4003, reason: "Authentication timeout." } as const;
const WS_CLOSE_SESSION_REPLACED = { code: 4004, reason: "Session replaced." } as const;
const WS_CLOSE_SERVER_FULL = { code: 4005, reason: "Server is full." } as const;

const AUTH_TIMEOUT_WS = 60_000;

export default async function wsRoute(app: FastifyInstance, config: WsRouteConfiguration) {
    const registry = new Map<string, { ws: WebSocket, role: UserRole, username: string }>();
    app.get('/ws', { websocket: true }, async (socket, request) => {
        let authenticated = false;
        let subject: string | undefined;
        let username: string | undefined;
        config.wsEventReporter.connected(request.ip);
        let schedulerCallback = () => {
            config.wsEventReporter.authenticationTimeout(request.ip);
            socket.close(WS_CLOSE_AUTH_TIMEOUT.code, WS_CLOSE_AUTH_TIMEOUT.reason);
        };
        const handle = config.scheduler.schedule(schedulerCallback, AUTH_TIMEOUT_WS);
        socket.on('message', async (data) => {
            if (authenticated) {
                try {
                    const syncMessage: { type?: string } = JSON.parse(data.toString());
                    if (syncMessage.type === "request_game_state") {
                        const connectedBuzzers = [...registry.values()].filter(e => e.role === UserRole.PLAYER).map(e => ({ username: e.username }));
                        socket.send(JSON.stringify({ type: "game_state_sync", connected_buzzers: connectedBuzzers }));
                    }
                } catch { }
                return;
            }
            authenticated = true;
            handle.cancel();
            let message: { type?: string, token?: string };
            try {
                message = JSON.parse(data.toString());
            } catch {
                config.wsEventReporter.invalidToken(request.ip);
                socket.close(WS_CLOSE_INVALID_TOKEN.code, WS_CLOSE_INVALID_TOKEN.reason);
                return;
            }
            if (message.type !== "auth") {
                config.wsEventReporter.invalidToken(request.ip);
                socket.close(WS_CLOSE_INVALID_TOKEN.code, WS_CLOSE_INVALID_TOKEN.reason);
                return;
            }
            if (message.token === undefined) {
                config.wsEventReporter.invalidToken(request.ip);
                socket.close(WS_CLOSE_INVALID_TOKEN.code, WS_CLOSE_INVALID_TOKEN.reason);
                return;
            }
            const inspection = config.tokenValidator.inspectToken(message.token);
            if (inspection.reason === "expired") {
                config.wsEventReporter.tokenExpired(request.ip);
                socket.close(WS_CLOSE_TOKEN_EXPIRED.code, WS_CLOSE_TOKEN_EXPIRED.reason);
                return;
            }
            if (!inspection.valid) {
                config.wsEventReporter.invalidToken(request.ip);
                socket.close(WS_CLOSE_INVALID_TOKEN.code, WS_CLOSE_INVALID_TOKEN.reason);
                return;
            }
            subject = config.subjectExtractor.extract(message.token);
            const participant = await config.participantResolver.resolve(subject);
            if (participant === null) {
                config.wsEventReporter.invalidToken(request.ip);
                socket.close(WS_CLOSE_INVALID_TOKEN.code, WS_CLOSE_INVALID_TOKEN.reason);
                return;
            }
            if (participant.role === UserRole.ADMIN) {
                const oldAdmin = [...registry.entries()].find(([, entry]) => entry.role === UserRole.ADMIN);
                if (oldAdmin !== undefined) {
                    const [oldSub, oldEntry] = oldAdmin;
                    registry.delete(oldSub);
                    oldEntry.ws.close(WS_CLOSE_SESSION_REPLACED.code, WS_CLOSE_SESSION_REPLACED.reason);
                }
            }
            const existing = registry.get(subject);
            if (existing === undefined && registry.size >= config.maxConnections) {
                config.wsEventReporter.serverFull(request.ip);
                socket.close(WS_CLOSE_SERVER_FULL.code, WS_CLOSE_SERVER_FULL.reason);
                return;
            }
            if (existing !== undefined) {
                existing.ws.close(WS_CLOSE_SESSION_REPLACED.code, WS_CLOSE_SESSION_REPLACED.reason);
            }
            username = participant.username;
            registry.set(subject, { ws: socket, role: participant.role, username: participant.username });
            const expiration = config.expirationExtractor.extract(message.token);
            const now = config.clock.now().getTime() / 1000;
            const expiresIn = Math.floor(expiration - now);
            socket.send(JSON.stringify({
                type: "auth_success",
                username: participant.username,
                role: toRoleLabel(participant.role),
                expires_in: expiresIn
            }));
            const admin = [...registry.values()].find(e => e.role === UserRole.ADMIN);
            const buzzersConnected = [...registry.values()].filter(e => e.role === UserRole.PLAYER).length;
            const adminConnected = admin !== undefined;
            admin?.ws.send(JSON.stringify({ type: "buzzer_connected", username: participant.username }));
            config.wsEventReporter.authenticated({ buzzersConnected, adminConnected, buzzersMax: config.maxConnections });
        });
        socket.on('close', () => {
            if (subject !== undefined) {
                const leaving = registry.get(subject);
                if (leaving?.role === UserRole.PLAYER) {
                    const admin = [...registry.values()].find(e => e.role === UserRole.ADMIN);
                    admin?.ws.send(JSON.stringify({ type: "buzzer_disconnected", username }));
                }
                registry.delete(subject);
                const buzzersConnected = [...registry.values()].filter(e => e.role === UserRole.PLAYER).length;
                const adminConnected = [...registry.values()].some(e => e.role === UserRole.ADMIN);
                config.wsEventReporter.disconnected({ buzzersConnected, adminConnected, buzzersMax: config.maxConnections });
            }
        });
    });
}