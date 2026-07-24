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
import { Scheduler } from "../common/scheduler.interface";
import { SubjectExtractor } from "../authentication/subject-extractor.interface";
import { ParticipantResolver } from "../authentication/participant-resolver.interface";
import { TokenGenerator } from "../authentication/token-generator.interface";
import { AuthenticationService } from "../authentication/authentication-service.interface";
import { ExpirationExtractor } from "../authentication/expiration-extractor";
import { WsEventReporter } from "./ws-event-reporter.interface";

describe("WebSocket", () => {
    let mockClock: Clock;
    let capturedCallback: () => void;
    let mockScheduler: Scheduler;
    let mockNetwork: Network;
    let port: number;
    let mockQuizServerConfiguration: QuizServerConfiguration;
    let mockAuthenticationService: AuthenticationService;
    let mockSubjectExtractor: SubjectExtractor;
    let mockParticipantResolver: ParticipantResolver;
    let mockExpirationExtractor: ExpirationExtractor;
    let mockTokenGenerator: TokenGenerator;
    let mockTokenDecoder: TokenDecoder;
    let mockThemeService: ThemeService;
    let mockUuidValidator: UuidValidator;
    let mockTokenValidator: TokenValidator;
    let mockWsEventReporter: WsEventReporter;
    let mockMiddleware: (app: FastifyInstance, options: { tokenValidator: TokenValidator }) => Promise<void> = async (app, options) => { };
    let mockRateLimitMiddleware: (app: FastifyInstance) => Promise<void> = async (app) => { };
    let mockTokenRouteConfiguration: TokenRouteConfiguration;
    let mockThemeRouteConfiguration: ThemeRouteConfiguration;
    let mockWsRouteConfiguration: WsRouteConfiguration;
    let server: QuizServer;

    beforeEach(async () => {
        mockClock = {
            now: () => new Date('2026-04-02T14:32:07')
        };
        mockNetwork = {
            networkInterfaces: () => ({
                'eth0': [
                    { address: '192.168.1.42', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:00', internal: false, cidr: '192.168.1.42/24' }
                ]
            })
        };
        port = 3001;
        mockScheduler = {
            schedule: vi.fn((callback) => {
                capturedCallback = callback;
                return { cancel: () => { capturedCallback = () => { }; } };
            })
        };
        mockQuizServerConfiguration = {
            clock: mockClock,
            network: mockNetwork,
            port: port
        }
        mockAuthenticationService = {
            authenticate: vi.fn().mockResolvedValue({ id: 'user-id', username: 'User Name', password: 'user-password', role: 'PLAYER' })
        };
        mockSubjectExtractor = {
            extract: vi.fn()
        };
        mockParticipantResolver = {
            resolve: vi.fn()
        };
        mockExpirationExtractor = {
            extract: vi.fn()
        };
        mockTokenGenerator = {
            generateToken: (user: User) => {
                return { token: 'generated-token' } as Token;
            }
        };
        mockTokenDecoder = {
            decode: vi.fn().mockReturnValue({ role: UserRole.PLAYER } as DecodedToken)
        };
        mockWsEventReporter = {
            connected: vi.fn(),
            tokenExpired: vi.fn()
        }
        mockThemeService = {
            createTheme: vi.fn(),
            deleteTheme: vi.fn(),
            getAll: vi.fn(),
            getById: vi.fn(),
            updateTheme: vi.fn()
        };
        mockUuidValidator = {
            validate: vi.fn()
        };
        mockTokenValidator = {
            validateToken: vi.fn(),
            inspectToken: vi.fn()
        };
        mockTokenRouteConfiguration = {
            authenticationService: mockAuthenticationService,
            tokenGenerator: mockTokenGenerator,
            rateLimitMiddleware: mockRateLimitMiddleware
        };
        mockThemeRouteConfiguration = {
            themeService: mockThemeService,
            uuidValidator: mockUuidValidator,
            tokenValidator: mockTokenValidator,
            tokenDecoder: mockTokenDecoder,
            middleware: mockMiddleware,
            rateLimitMiddleware: mockRateLimitMiddleware
        };
        mockWsRouteConfiguration = {
            tokenValidator: mockTokenValidator,
            scheduler: mockScheduler,
            subjectExtractor: mockSubjectExtractor,
            participantResolver: mockParticipantResolver,
            expirationExtractor: mockExpirationExtractor,
            clock: mockClock,
            wsEventReporter: mockWsEventReporter
        };
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
        mockTokenValidator.inspectToken = vi.fn().mockReturnValue({ valid: false, reason: "invalid" });
        const client = new WebSocket(`ws://localhost:${port}/ws`);
        const received = await new Promise<{ code: number, reason: string }>((resolve, reject) => {
            client.on('open', () => {
                client.send(JSON.stringify({ type: "auth", token: "X" }));
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
                client.send(JSON.stringify({ type: "auth" }));
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
    it("closes the connection after the authentication timeout", async () => {
        const client = new WebSocket(`ws://localhost:${port}/ws`);
        const received = await new Promise<{ code: number, reason: string }>((resolve, reject) => {
            client.on('open', () => {
                capturedCallback();
            });
            client.on('close', (code, reason) => {
                resolve({ code, reason: reason.toString() });
            });
            client.on('message', () => reject(new Error("expected close, but received a message")));
            client.on('error', (err) => reject(err));
        });
        expect(received.code).toBe(4003);
        expect(received.reason).toBe("Authentication timeout.");
    });
    it("keeps the connection open after an authentication message", async () => {
        mockTokenValidator.inspectToken = vi.fn().mockReturnValue({ valid: true, reason: "valid" });
        mockSubjectExtractor.extract = vi.fn().mockReturnValue("sub-01");
        mockParticipantResolver.resolve = vi.fn().mockResolvedValue({ username: "quiz_buzzer_01" });
        const client = new WebSocket(`ws://localhost:${port}/ws`);
        await new Promise<void>((resolve, reject) => {
            client.on('open', () => {
                client.send(JSON.stringify({ type: "auth", token: "X" }));
            });
            client.on('message', () => {
                capturedCallback();
                setTimeout(() => resolve(), 100);   // fenêtre : si un 4003 devait tomber, il tombe avant
            });
            client.on('close', (code) => {
                if (code === 4003) reject(new Error("authentication timeout fired after a message"));
            });
            client.on('error', (err) => reject(err));
        });
        client.close();
    });
    it("closes the connection when the token has expired", async () => {
        mockTokenValidator.inspectToken = vi.fn().mockReturnValue({ valid: false, reason: "expired" })
        const client = new WebSocket(`ws://localhost:${port}/ws`);
        const received = await new Promise<{ code: number, reason: string }>((resolve, reject) => {
            client.on('open', () => {
                client.send(JSON.stringify({ type: "auth", token: "X" }));
            });
            client.on('close', (code, reason) => {
                resolve({ code, reason: reason.toString() });
            });
            client.on('message', () => reject(new Error("expected close, but received a message")));
            client.on('error', (err) => reject(err));
        });
        expect(received.code).toBe(4002);
        expect(received.reason).toBe("Token expired.");
        expect(mockWsEventReporter.tokenExpired).toHaveBeenCalledWith("127.0.0.1");
    });
    it("closes the connection when the subject resolves to no participant", async () => {
        mockTokenValidator.inspectToken = vi.fn().mockReturnValue({ valid: true, reason: "valid" });
        mockSubjectExtractor.extract = vi.fn().mockReturnValue("sub-01");
        mockParticipantResolver.resolve = vi.fn().mockResolvedValue(null);
        const client = new WebSocket(`ws://localhost:${port}/ws`);
        const received = await new Promise<{ code: number, reason: string }>((resolve, reject) => {
            client.on('open', () => {
                client.send(JSON.stringify({ type: "auth", token: "X" }));
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
    it("replies with auth_success carrying the username", async () => {
        mockTokenValidator.inspectToken = vi.fn().mockReturnValue({ valid: true, reason: "valid" });
        mockSubjectExtractor.extract = vi.fn().mockReturnValue("resolved-sub");
        mockParticipantResolver.resolve = vi.fn()
            .mockImplementation((sub) => sub === "resolved-sub" ? { username: "quiz_buzzer_01" } : { username: "wrong" });
        const client = new WebSocket(`ws://localhost:${port}/ws`);
        const received = await new Promise<{ username: string }>((resolve, reject) => {
            client.on('open', () => {
                client.send(JSON.stringify({ type: "auth", token: "X" }));
            });
            client.on('error', (err) => reject(err));
            client.on('message', (data) => {
                resolve(JSON.parse(data.toString()));
            });
        });
        expect(received.username).toBe("quiz_buzzer_01");
        client.close();
    });
    it.each([
        [UserRole.PLAYER, "buzzer"],
        [UserRole.ADMIN, "admin"],
    ])("replies with auth_success carrying the role for %s", async (role, expectedLabel) => {
        mockTokenValidator.inspectToken = vi.fn().mockReturnValue({ valid: true, reason: "valid" });
        mockSubjectExtractor.extract = vi.fn().mockReturnValue("resolved-sub");
        mockParticipantResolver.resolve = vi.fn().mockResolvedValue({ id: "any-id", username: "any-user-name", role });
        const client = new WebSocket(`ws://localhost:${port}/ws`);
        const received = await new Promise<{ role: string }>((resolve, reject) => {
            client.on('open', () => {
                client.send(JSON.stringify({ type: "auth", token: "X" }));
            });
            client.on('error', (err) => reject(err));
            client.on('message', (data) => {
                resolve(JSON.parse(data.toString()));
            });
        });
        expect(received.role).toBe(expectedLabel);
        client.close();
    });
    it("replies with auth_success carrying the remaining time for token", async () => {
        mockTokenValidator.inspectToken = vi.fn().mockReturnValue({ valid: true, reason: "valid" });
        mockSubjectExtractor.extract = vi.fn().mockReturnValue("resolved-sub");
        mockParticipantResolver.resolve = vi.fn().mockResolvedValue({ id: "any-id", username: "any-user-name", role: UserRole.PLAYER });
        const frozenNowInSeconds = new Date('2026-04-02T14:32:07').getTime() / 1000;
        mockExpirationExtractor.extract = vi.fn().mockReturnValue(frozenNowInSeconds + 3600);
        const client = new WebSocket(`ws://localhost:${port}/ws`);
        const received = await new Promise<{ expires_in: number }>((resolve, reject) => {
            client.on('open', () => {
                client.send(JSON.stringify({ type: "auth", token: "X" }));
            });
            client.on('error', (err) => reject(err));
            client.on('message', (data) => {
                resolve(JSON.parse(data.toString()));
            });
        });
        expect(received.expires_in).toBe(3600);
        client.close();
    });
    it("reports the connection with IP address even when authentication fails", async () => {
        mockTokenValidator.inspectToken = vi.fn().mockReturnValue({ valid: false, reason: "invalid" });
        const client = new WebSocket(`ws://localhost:${port}/ws`);
        await new Promise<void>((resolve, reject) => {
            client.on('open', () => {
                client.send(JSON.stringify({ type: "auth", token: "X" }));
            });
            client.on('close', () => resolve());
            client.on('message', () => reject(new Error("expected close, but received a message")));
            client.on('error', (err) => reject(err));
        });
        expect(mockWsEventReporter.connected).toHaveBeenCalledWith("127.0.0.1");
    });
    afterEach(async () => {
        await server.stop();
    });
});