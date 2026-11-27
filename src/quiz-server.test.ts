import { afterEach, describe, expect, it, vi } from "vitest";
import { QuizServer } from "./quiz-server";
import { ThemeRouteConfiguration } from "./themes/theme-route-configuration.interface";
import { QuestionRouteConfiguration } from "./questions/question-route-configuration.interface";
import { TokenRouteConfiguration } from "./authentication/token-route-configuration.interface";
import { WsRouteConfiguration } from "./websocket/ws-route-configuration.interface";

describe("US-001/CA-1 (decision #51) - The hub listens on every IPv4 interface, not on the loopback alone", () => {
    let server: QuizServer;
    afterEach(async () => {
        await server.stop();
        vi.restoreAllMocks();
    });
    it("asks for the address 0.0.0.0", async () => {
        vi.spyOn(console, "log").mockImplementation(() => { });
        const routeConfiguration = { middleware: async () => { } };
        server = new QuizServer(
            { clock: { now: () => new Date() }, network: { networkInterfaces: () => ({}) }, port: 0, rateLimitMiddleware: async () => { } },
            {} as TokenRouteConfiguration,
            routeConfiguration as unknown as ThemeRouteConfiguration,
            {} as WsRouteConfiguration,
            routeConfiguration as unknown as QuestionRouteConfiguration
        );
        const listen = vi.spyOn(server["app"], "listen");
        await server.start();
        expect(listen).toHaveBeenCalledWith(expect.objectContaining({ port: 0, host: "0.0.0.0" }));
    });
});
