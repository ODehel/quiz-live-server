import { beforeEach, describe, expect, it, vi } from "vitest";
import pino from 'pino';
import { PinoWsEventReporter } from "./pino-ws-event-reporter";

describe("Pino websocket event reporter", () => {
    let mockPino: Pick<pino.Logger, 'info' | 'warn'>;
    let reporter: PinoWsEventReporter;
    let clientIp = "127.0.0.1" as const;

    beforeEach(() => {
        mockPino = {
            info: vi.fn(),
            warn: vi.fn()
        };
        reporter = new PinoWsEventReporter(mockPino);
    });

    it("reports an established connection with its IP", () => {
        reporter.connected(clientIp);
        expect(mockPino.info).toHaveBeenCalledWith({ event: "WEBSOCKET_CONNECTED", ip: clientIp });
    });

    it("reports a connection close because of a token expired", () => {
        reporter.tokenExpired(clientIp);
        expect(mockPino.warn).toHaveBeenCalledWith({ event: "WEBSOCKET_AUTH_FAILED", reason: "Token expired.", ip: clientIp })
    });

    it("reports a connection close because of an invalid token", () => {
        reporter.invalidToken(clientIp);
        expect(mockPino.warn).toHaveBeenCalledWith({ event: "WEBSOCKET_AUTH_FAILED", reason: "Invalid token.", ip: clientIp });
    });

    it("reports a connection close because of an authentication timeout", () => {
        reporter.authenticationTimeout(clientIp);
        expect(mockPino.warn).toHaveBeenCalledWith({ event: "WEBSOCKET_AUTH_FAILED", reason: "Authentication timeout.", ip: clientIp });
    });

    it("reports that the server is full with its IP", () => {
        reporter.serverFull(clientIp);
        expect(mockPino.info).toHaveBeenCalledWith({ event: "WEBSOCKET_SERVER_FULL", ip: clientIp });
    });

    it.each([
        [true, 1],
        [false, 0],
    ])("reports a successful authentication with admin_connected %s as %s", (adminConnected, expected) => {
        reporter.authenticated({ buzzersConnected: 3, adminConnected, buzzersMax: 10 });
        expect(mockPino.info).toHaveBeenCalledWith({
            event: "WEBSOCKET_AUTHENTICATED",
            buzzers_connected: 3,
            buzzers_max: 10,
            admin_connected: expected
        });
    });

    it.each([
        [true, 1],
        [false, 0]
    ])("reports a disconnection with admin_connected %s as %s", (adminConnected, expected) => {
        reporter.disconnected({ buzzersConnected: 3, adminConnected, buzzersMax: 10 });
        expect(mockPino.info).toHaveBeenCalledWith({
            event: "WEBSOCKET_DISCONNECTED",
            buzzers_connected: 3,
            buzzers_max: 10,
            admin_connected: expected
        });
    });
});