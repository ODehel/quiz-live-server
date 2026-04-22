import { beforeEach, describe, expect, it, vi } from "vitest";
import { TokenValidator } from "./token-validator.interface";
import Fastify, { FastifyInstance } from "fastify";
import authenticationMiddleware from "./authentication-middleware";

describe("US-004/CA-32 - Test of the middleware", () => {
    let mockTokenValidator: TokenValidator;
    let app: FastifyInstance;
    beforeEach(async () => {
        mockTokenValidator = {
            validateToken: vi.fn().mockReturnValue(true)
        };
        app = Fastify();
        await authenticationMiddleware(app, { tokenValidator: mockTokenValidator });
        app.get('/api/v1/themes', async () => {
            return { status: 'ok' };
        });
    });
    it("should return a HTML 200", async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/themes',
            headers: { 'Authorization': 'Bearer blabla' }
        })
        expect(response.statusCode).toBe(200);
    });
});

describe("US-004/CA-32 - No token", () => {
    let mockTokenValidator: TokenValidator;
    let app: FastifyInstance;
    beforeEach(async () => {
        mockTokenValidator = {
            validateToken: vi.fn()
        };
        app = Fastify();
        await authenticationMiddleware(app, { tokenValidator: mockTokenValidator });
        app.get("/api/v1/themes", async () => {
            return { status: 'Missing token' };
        });
    });
    it("should return a HTML 401", async() => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/themes'
        })
        expect(response.statusCode).toBe(401);
    });
});

describe("US-004/CA-32 - Inva token", () => {
    let mockTokenValidator: TokenValidator;
    let app: FastifyInstance;
    beforeEach(async () => {
        mockTokenValidator = {
            validateToken: vi.fn().mockReturnValue(false)
        };
        app = Fastify();
        await authenticationMiddleware(app, { tokenValidator: mockTokenValidator });
        app.get("/api/v1/themes", async () => {
            return { status: 'Invalid token' };
        });
    });
    it("should return a HTML 401", async() => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/themes',
            headers: { 'Authorization': 'Bearer blabla' }
        })
        expect(response.statusCode).toBe(401);
    });
});