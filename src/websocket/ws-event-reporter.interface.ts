export interface WsEventReporter {
    connected(clientIp: string): void;
    tokenExpired(clientIp: string): void;
    invalidToken(clientIp: string): void;
    authenticationTimeout(clientIp: string): void;
    serverFull(clientIp: string): void;
    internalError(clientIp: string): void;
    authenticated(summary: { buzzersConnected: number; adminConnected: boolean; buzzersMax: number }): void;
    disconnected(summary: { buzzersConnected: number; adminConnected: boolean; buzzersMax: number }): void;
    rateLimited(clientIp: string): void;
}