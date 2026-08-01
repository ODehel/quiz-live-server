import { WsEventReporter } from "./ws-event-reporter.interface";
import pino from 'pino';

export class PinoWsEventReporter implements WsEventReporter {
    constructor(private logger: Pick<pino.Logger, 'info' | 'warn'>) {
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

    private reportAuthFailure(reason: string, clientIp: string): void {
        this.logger.warn({ event: "WEBSOCKET_AUTH_FAILED", reason, ip: clientIp });
    }
}