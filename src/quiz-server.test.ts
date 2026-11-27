import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuizServer } from "./quiz-server";
import { ThemeRouteConfiguration } from "./themes/theme-route-configuration.interface";
import { QuestionRouteConfiguration } from "./questions/question-route-configuration.interface";
import { TokenRouteConfiguration } from "./authentication/token-route-configuration.interface";
import { WsRouteConfiguration } from "./websocket/ws-route-configuration.interface";

describe("The assembled hub", () => {
    let server: QuizServer;
    beforeEach(() => {
        vi.spyOn(console, "log").mockImplementation(() => { });
        const routeConfiguration = { middleware: async () => { } };
        server = new QuizServer(
            { clock: { now: () => new Date() }, network: { networkInterfaces: () => ({}) }, port: 0, rateLimitMiddleware: async () => { } },
            {} as TokenRouteConfiguration,
            routeConfiguration as unknown as ThemeRouteConfiguration,
            {} as WsRouteConfiguration,
            routeConfiguration as unknown as QuestionRouteConfiguration
        );
    });
    afterEach(async () => {
        await server.stop();
        vi.restoreAllMocks();
    });
    it("US-001/CA-1 (decision #51) asks for the address 0.0.0.0, not the loopback alone", async () => {
        const listen = vi.spyOn(server["app"], "listen");
        await server.start();
        expect(listen).toHaveBeenCalledWith(expect.objectContaining({ port: 0, host: "0.0.0.0" }));
    });
    it("US-003/CA-14 and CA-15 keeps its logger on, the authentication logs go through it", () => {
        expect(server["app"].log.level).toBe("info");
    });
});
