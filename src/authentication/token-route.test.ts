import Fastify, { FastifyInstance } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticationService } from "./authentication-service.interface";
import { TokenGenerator } from "./token-generator.interface";
import { User } from "../users/user.interface";
import { UserRole } from "../users/user-role";
import { Token } from "./token.interface";
import tokenRoute from "../authentication/token-route";

let app: FastifyInstance;
let mockAuthenticationService: AuthenticationService;
let mockTokenGenerator: TokenGenerator;
beforeEach(async () => {
    mockAuthenticationService = {
        authenticate: vi.fn().mockResolvedValue({ id: 'user-id', username: 'User Name', password: 'user-password', role: UserRole.PLAYER } as User)
    };
    mockTokenGenerator = {
        generateToken: (user) => {
            return { token: 'generated-token' } as Token;
        }
    };
    app = Fastify();
    await app.register(tokenRoute, { authenticationService: mockAuthenticationService, tokenGenerator: mockTokenGenerator, maxRequestsPerMinute: 5 });
});

describe('US-003/CA-05: Without token', () => {
    it('should return 200', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/token',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'User Name', password: 'user-password' })
        })
        expect(response.statusCode).toBe(200);
    });
});

describe('US-003/CA-06: With wrong property', () => {
    it('should return 400', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/token',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'User Name', passyord: 'user-password' })
        })
        expect(response.statusCode).toBe(400)
    });
});

describe('US-003/CA-07: With wrong content type', () => {
    it('should return 415', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/token',
            headers: { 'Content-Type': 'application/xml' },
            body: '<root><username>User Name</username><password>user-password</password></root>'
        })
        expect(response.statusCode).toBe(415)
    });
});

describe('US-003/CA-08: With wrong credentials', () => {
    it('should return 401', async () => {
        vi.mocked(mockAuthenticationService.authenticate).mockResolvedValue(undefined);
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/token',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'User Name', password: 'wrong-password' })
        })
        expect(response.statusCode).toBe(401)
    });
});

describe('US-003/CA-09: Without login', () => {
    it('should return 400', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/token',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'User Name' })
        })
        expect(response.statusCode).toBe(400)
    });
});

describe('US-003/CA-10: Without password', () => {
    it('should return 400', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/token',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login: 'user-login' })
        })
        expect(response.statusCode).toBe(400)
    });
});

describe('US-003/CA-11: Without body', () => {
    it('should return 400', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/token',
            headers: { 'Content-Type': 'application/json' }
        })
        expect(response.statusCode).toBe(400)
    });
});

describe('US-003/CA-13: When rate limit is exceeded', () => {
    it('should return 429', async () => {
        for (let i = 0; i < 5; i++) {   
            await app.inject({
                method: 'POST',
                url: '/api/v1/token',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'User Name', password: 'user-password' })
            })
        }
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/token',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'User Name', password: 'user-password' })
        });
        expect(response.statusCode).toBe(429);
    });
});