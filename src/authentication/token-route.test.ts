import Fastify, { FastifyInstance } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticationService } from "./authentication-service.interface";
import { TokenGenerator } from "./token-generator.interface";
import { UserRole } from "../users/user-role";
import { Token } from "./token.interface";
import tokenRoute from "../authentication/token-route";
import rateLimitMiddleware from "../infrastructure/rate-limit-middleware";

let app: FastifyInstance;
let mockAuthenticationService: AuthenticationService;
let mockTokenGenerator: TokenGenerator;
let mockRateLimitMiddleware: (app: FastifyInstance) => Promise<void>;
beforeEach(async () => {
    mockAuthenticationService = {
        authenticate: vi.fn().mockResolvedValue({ id: 'user-id', username: 'User Name', password: 'user-password', role: UserRole.PLAYER })
    };
    mockTokenGenerator = {
        generateToken: () => {
            const token: Token = { token: 'generated-token', expiresIn: 3600, tokenType: 'Bearer' };
            return token;
        }
    };
    mockRateLimitMiddleware = async () => { };
    app = Fastify();
    await app.register(tokenRoute, { authenticationService: mockAuthenticationService, tokenGenerator: mockTokenGenerator, rateLimitMiddleware: mockRateLimitMiddleware });
});

describe('US-003/CA-01: With valid credentials', () => {
    it('should return the token, its lifetime and its type in snake_case', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/token',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'User Name', password: 'user-password' })
        })
        expect(response.json()).toEqual({ token: 'generated-token', expires_in: 3600, token_type: 'Bearer' });
    });
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

describe('US-003/CA-06 (CA-12): With valid credentials and an unknown field', () => {
    it('should return 400 UNKNOWN_FIELDS naming the field', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/token',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'User Name', password: 'user-password', extra: 1 })
        })
        expect(response.statusCode).toBe(400);
        expect(response.json()).toEqual({ status: 400, error: 'UNKNOWN_FIELDS', message: 'Unknown field(s): extra.' });
    });

    it('should not authenticate', async () => {
        await app.inject({
            method: 'POST',
            url: '/api/v1/token',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'User Name', password: 'user-password', extra: 1 })
        })
        expect(mockAuthenticationService.authenticate).not.toHaveBeenCalled();
    });

    it('should name every unknown field', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/token',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'User Name', password: 'user-password', first: 1, second: 2 })
        })
        expect(response.json()).toEqual({ status: 400, error: 'UNKNOWN_FIELDS', message: 'Unknown field(s): first, second.' });
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

    it('should return the standard error body INVALID_CREDENTIALS', async () => {
        vi.mocked(mockAuthenticationService.authenticate).mockResolvedValue(undefined);
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/token',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'User Name', password: 'wrong-password' })
        })
        expect(response.json()).toEqual({ status: 401, error: 'INVALID_CREDENTIALS', message: 'Invalid credentials.' });
    });
});

describe('US-003/CA-09: Without username', () => {
    it('should return 400', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/token',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: 'user-password' })
        })
        expect(response.statusCode).toBe(400)
    });

    it('should return the standard error body VALIDATION_ERROR naming the username', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/token',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: 'user-password' })
        })
        expect(response.json()).toEqual({ status: 400, error: 'VALIDATION_ERROR', message: 'Username is required.' });
    });

    it('should return the same VALIDATION_ERROR when the username is empty', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/token',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: '', password: 'user-password' })
        })
        expect(response.statusCode).toBe(400);
        expect(response.json()).toEqual({ status: 400, error: 'VALIDATION_ERROR', message: 'Username is required.' });
    });

    it('should not authenticate', async () => {
        await app.inject({
            method: 'POST',
            url: '/api/v1/token',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: 'user-password' })
        })
        expect(mockAuthenticationService.authenticate).not.toHaveBeenCalled();
    });
});

describe('US-003/CA-10: Without password', () => {
    it('should return 400', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/token',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'User Name' })
        })
        expect(response.statusCode).toBe(400)
    });

    it('should return the standard error body VALIDATION_ERROR naming the password', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/token',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'User Name' })
        })
        expect(response.json()).toEqual({ status: 400, error: 'VALIDATION_ERROR', message: 'Password is required.' });
    });

    it('should return the same VALIDATION_ERROR when the password is empty', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/token',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'User Name', password: '' })
        })
        expect(response.statusCode).toBe(400);
        expect(response.json()).toEqual({ status: 400, error: 'VALIDATION_ERROR', message: 'Password is required.' });
    });

    it('should not authenticate', async () => {
        await app.inject({
            method: 'POST',
            url: '/api/v1/token',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'User Name' })
        })
        expect(mockAuthenticationService.authenticate).not.toHaveBeenCalled();
    });
});

describe('US-003/CA-11: With a body that is not valid JSON', () => {
    it('should return 400 INVALID_JSON', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/token',
            headers: { 'Content-Type': 'application/json' },
            body: '{"username":'
        });
        expect(response.statusCode).toBe(400);
        expect(response.json()).toEqual({ status: 400, error: 'INVALID_JSON', message: 'Request body must be valid JSON.' });
    });
});

describe('US-003/CA-11: Without body', () => {
    it('should return 400 INVALID_JSON', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/token',
            headers: { 'Content-Type': 'application/json' }
        })
        expect(response.statusCode).toBe(400)
        expect(response.json()).toEqual({ status: 400, error: 'INVALID_JSON', message: 'Request body must be valid JSON.' })
    });
});

describe('US-003/CA-13: When rate limit is exceeded', () => {
    let lowRateLimitMiddleware: (app: FastifyInstance) => Promise<void>;
    beforeEach(async () => {
        app = Fastify();
        lowRateLimitMiddleware = (app) => rateLimitMiddleware(app, { maxRequestsPerMinute: 5 });
        await app.register(tokenRoute, { authenticationService: mockAuthenticationService, tokenGenerator: mockTokenGenerator, rateLimitMiddleware: lowRateLimitMiddleware });
    });
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
