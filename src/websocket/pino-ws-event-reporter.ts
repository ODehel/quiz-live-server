import { WsEventReporter } from "./ws-event-reporter.interface";
import pino from 'pino';

export class PinoWsEventReporter implements WsEventReporter {
    private logger = pino();
    connected(): void {
        this.logger.info({ event: "WEBSOCKET_CONNECTED" });
    }
}