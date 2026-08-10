import { WsEventReporter } from "./ws-event-reporter.interface";
import pino from 'pino';

export class PinoWsEventReporter implements WsEventReporter {
    constructor(private logger: Pick<pino.Logger, 'info' | 'warn' | 'error'>) {
    }

    connected(clientIp: string): void {
        this.logger.info({ event: "WEBSOCKET_CONNECTED", ip: clientIp });
    }

    tokenExpired(clientIp: string): void {
        this.reportAuthFailure("Token expired.", clientIp);
    }

    invalidToken(clientIp: string): void {
        this.reportAuthFailure("Invalid token.", clientIp);
    }

    authenticationTimeout(clientIp: string): void {
        this.reportAuthFailure("Authentication timeout.", clientIp);
    }

    serverFull(clientIp: string): void {
        this.logger.info({ event: "WEBSOCKET_SERVER_FULL", ip: clientIp });
    }

    internalError(clientIp: string): void {
        this.logger.error({ event: "WEBSOCKET_INTERNAL_ERROR", ip: clientIp });
    }
    
    authenticated(summary: { buzzersConnected: number; adminConnected: boolean; buzzersMax: number }): void {
        this.logger.info({
            event: "WEBSOCKET_AUTHENTICATED",
            buzzers_connected: summary.buzzersConnected,
            buzzers_max: summary.buzzersMax,
            admin_connected: summary.adminConnected ? 1 : 0
        });
    }

    disconnected(summary: { buzzersConnected: number; adminConnected: boolean; buzzersMax: number }): void {
        this.logger.info({
            event: "WEBSOCKET_DISCONNECTED",
            buzzers_connected: summary.buzzersConnected,
            buzzers_max: summary.buzzersMax,
            admin_connected: summary.adminConnected ? 1 : 0
        });
    }

    private reportAuthFailure(reason: string, clientIp: string): void {
        this.logger.warn({ event: "WEBSOCKET_AUTH_FAILED", reason, ip: clientIp });
    }
}