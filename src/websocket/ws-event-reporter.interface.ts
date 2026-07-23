export interface WsEventReporter {
    connected(clientIp: string): void;
}