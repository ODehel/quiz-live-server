import { WsEventReporter } from "./ws-event-reporter.interface";
import pino from 'pino';

export class PinoWsEventReporter implements WsEventReporter {
    private logger = pino();
    connected(clientIp: string): void {
        this.logger.info({ event: "WEBSOCKET_CONNECTED", ip: clientIp });
    }
    tokenExpired(clientIp: string): void {
        this.logger.warn({ event: "WEBSOCKET_AUTH_FAILED", reason: "Token expired.", ip: clientIp });
    }
}