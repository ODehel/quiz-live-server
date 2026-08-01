export interface WsEventReporter {
    connected(clientIp: string): void;
    tokenExpired(clientIp: string): void;
    invalidToken(clientIp: string): void;
    authenticationTimeout(clientIp: string): void;
    serverFull(clientIp: string): void;
}