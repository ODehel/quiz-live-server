export interface WsEventReporter {
    connected(clientIp: string): void;
    tokenExpired(clientIp: string): void;
}