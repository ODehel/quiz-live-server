import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuizServer } from "../quiz-server";
import { ThemeRouteConfiguration } from "../themes/theme-route-configuration.interface";
import { TokenRouteConfiguration } from "../authentication/token-route-configuration.interface";
import { Clock } from "../common/clock.interface";
import { Network } from "../common/network.interface";
import { QuizServerConfiguration } from "../quiz-server-configuration.interface";
import { User } from "../users/user.interface";
import { Token } from "../authentication/token.interface";
import { TokenDecoder } from "../authentication/token-decoder.interface";
import { DecodedToken } from "../authentication/decoded-token.interface";
import { FastifyInstance } from "fastify";
import { TokenValidator } from "../authentication/token-validator.interface";
import { UuidValidator } from "../common/uuid-validator.interface";
import { ThemeService } from "../themes/theme-service.interface";
import { UserRole } from "../users/user-role";
import WebSocket from "ws";
import { WsRouteConfiguration } from "./ws-route-configuration.interface";



describe("WebSocket", () => {
    let mockClock: Clock = {
        now: () => new Date('2026-04-02T14:32:07')
    }

    let mockNetwork: Network = {
        networkInterfaces: () => ({
            'eth0': [
                { address: '192.168.1.42', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:00', internal: false, cidr: '192.168.1.42/24' }
            ]
        })
    }

    let port: number = 3001

    let mockQuizServerConfiguration: QuizServerConfiguration = {
        clock: mockClock,
        network: mockNetwork,
        port: port
    }

    let mockAuthenticationService = {
        authenticate: vi.fn().mockResolvedValue({ id: 'user-id', username: 'User Name', password: 'user-password', role: 'PLAYER' })
    };

    let mockTokenGenerator = {
        generateToken: (user: User) => {
            return { token: 'generated-token' } as Token;
        }
    };

    let mockTokenDecoder: TokenDecoder = {
        decode: vi.fn().mockReturnValue({ role: UserRole.PLAYER } as DecodedToken)
    };

    let mockThemeService: ThemeService = {
        createTheme: vi.fn(),
        deleteTheme: vi.fn(),
        getAll: vi.fn(),
        getById: vi.fn(),
        updateTheme: vi.fn()
    };
    let mockUuidValidator: UuidValidator = {
        validate: vi.fn()
    };
    let mockTokenValidator: TokenValidator = {
        validateToken: vi.fn()
    };
    let mockMiddleware: (app: FastifyInstance, options: { tokenValidator: TokenValidator }) => Promise<void> = async (app, options) => { };
    let mockRateLimitMiddleware: (app: FastifyInstance) => Promise<void> = async (app) => { };
    let mockTokenRouteConfiguration: TokenRouteConfiguration = {
        authenticationService: mockAuthenticationService,
        tokenGenerator: mockTokenGenerator,
        rateLimitMiddleware: mockRateLimitMiddleware
    };

    let mockThemeRouteConfiguration: ThemeRouteConfiguration = {
        themeService: mockThemeService,
        uuidValidator: mockUuidValidator,
        tokenValidator: mockTokenValidator,
        tokenDecoder: mockTokenDecoder,
        middleware: mockMiddleware,
        rateLimitMiddleware: mockRateLimitMiddleware
    };

    let mockWsRouteConfiguration: WsRouteConfiguration = {
        tokenValidator: mockTokenValidator
    };
    
    let server: QuizServer;
    beforeEach(async () => {
        mockTokenValidator.validateToken = vi.fn();
        server = new QuizServer(mockQuizServerConfiguration, mockTokenRouteConfiguration, mockThemeRouteConfiguration, mockWsRouteConfiguration);
        await server.start();
    });
    it("can connect to web socket", async () => {
        const client = new WebSocket(`ws://localhost:${port}/ws`);
        await new Promise<void>((resolve, reject) => {
            client.on('open', () => {
                client.close();
                resolve();
            });
            client.on('error', (err) => reject(err));
        });
    });
    it("rejects a message carrying an invalid token", async () => {
        mockTokenValidator.validateToken = vi.fn().mockReturnValue(false);
        const client = new WebSocket(`ws://localhost:${port}/ws`);
       const received = await new Promise<{ code: number, reason: string }>((resolve, reject) => {
            client.on('open', () => {
                client.send(JSON.stringify({token: "X"}));
            });
            client.on('close', (code, reason) => {
                resolve({ code, reason: reason.toString() });
            });
            client.on('message', () => reject(new Error("expected close, but received a message")));
            client.on('error', (err) => reject(err));
        });
        expect(received.code).toBe(4001);
        expect(received.reason).toBe("Invalid token.");
    });
    it("closes the connection with code and reason when message is not Json-typed", async () => {
        const client = new WebSocket(`ws://localhost:${port}/ws`);
        const received = await new Promise<{ code: number, reason: string }>((resolve, reject) => {
            client.on('open', () => {
                client.send("not json-typed at all");
            });
            client.on('close', (code, reason) => {
                resolve({ code, reason: reason.toString() });
            });
            client.on('message', () => reject(new Error("expected close, but received a message")));
            client.on('error', (err) => reject(err));
        });
        expect(received.code).toBe(4001);
        expect(received.reason).toBe("Invalid token.");
    });
    it("rejects a message without a token", async () => {
        const client = new WebSocket(`ws://localhost:${port}/ws`);
        const received = await new Promise<{ code: number, reason: string }>((resolve, reject) => {
            client.on('open', () => {
                client.send("{}");
            });
            client.on('close', (code, reason) => {
                resolve({ code, reason: reason.toString() });
            });
            client.on('message', () => reject(new Error("expected close, but received a message")));
            client.on('error', (err) => reject(err));
        });
        expect(received.code).toBe(4001);
        expect(received.reason).toBe("Invalid token.");
    });
    it("rejects a message without a type", async () => {
        mockTokenValidator.validateToken = vi.fn().mockReturnValue(true);
        const client = new WebSocket(`ws://localhost:${port}/ws`);
        const received = await new Promise<{ code: number, reason: string }>((resolve, reject) => {
            client.on('open', () => {
                client.send(JSON.stringify({ token: "X" }));
            });
            client.on('close', (code, reason) => {
                resolve({ code, reason: reason.toString() });
            });
            client.on('message', () => reject(new Error("expected close, but received a message")));
            client.on('error', (err) => reject(err));
        });
        expect(received.code).toBe(4001);
        expect(received.reason).toBe("Invalid token.");
    });
    it("replies with auth_success to a message carrying a valid token", async () => {
        mockTokenValidator.validateToken = vi.fn().mockReturnValue(true);
        const client = new WebSocket(`ws://localhost:${port}/ws`);
        const received = await new Promise<string>((resolve, reject) => {
            client.on('open', () => {
                client.send(JSON.stringify({ type: "auth", token: "X" }));
            });
            client.on('error', (err) => reject(err));
            client.on('message', (data) => {
                resolve(data.toString());
            });
        });
        expect(received).toBe(JSON.stringify({ type: "auth_success" }));
        client.close();
    });
    afterEach(async () => {
        await server.stop();
    });
});