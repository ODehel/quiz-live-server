export const MAX_CONNECTIONS_PER_IP = 15;
export const WINDOW_MS = 60_000;

export class WsConnectionPolicy {
    private lastConnections: Map<string, Date[]> = new Map<string, Date[]>();
    admit(ip: string, now: Date): boolean {
        const attempts = this.lastConnections.get(ip) ?? [];
        const lastMinuteAttempts = attempts.filter(d => now.getTime() - d.getTime() < WINDOW_MS);
        lastMinuteAttempts.push(now);
        this.lastConnections.set(ip, lastMinuteAttempts);
        return lastMinuteAttempts.length <= MAX_CONNECTIONS_PER_IP;
    }
}