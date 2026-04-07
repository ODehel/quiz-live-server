import Fastify, { FastifyInstance } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IAuthenticationService } from "../authentication/IAuthenticationService";
import { ITokenGenerator } from "../authentication/ITokenGenerator";
import { IUser } from "../users/IUser";
import { UserRole } from "../users/UserRole";
import { IToken } from "../authentication/IToken";
import tokenRoute from "./tokenRoute";

let app: FastifyInstance;
let mockAuthenticationService: IAuthenticationService;
let mockTokenGenerator: ITokenGenerator;
beforeEach(async () => {
    mockAuthenticationService = {
        authenticate: vi.fn().mockResolvedValue({ id: 'user-id', username: 'User Name', password: 'user-password', role: UserRole.PLAYER } as IUser)
    };
    mockTokenGenerator = {
        generateToken: (user) => {
            return { token: 'generated-token' } as IToken;
        }
    };
    app = Fastify();
    await app.register(tokenRoute, { authService: mockAuthenticationService, tokenGenerator: mockTokenGenerator });
});

describe('US-003/CA-05: Without token', () => {
    it('should return 200', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/token',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'User Name', password: 'user-password' })
        })
        expect(response.statusCode).toBe(200)
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