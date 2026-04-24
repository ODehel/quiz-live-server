import Fastify, { FastifyInstance } from 'fastify';
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Theme } from './theme.interface';
import { ThemeService } from './theme-service.interface';
import themeRoute from './theme-route';
import { ValidationError } from './validation-error';
import { ConflictError } from './conflict-error';
import { UuidValidator } from '../common/uuid-validator.interface';
import { Pagination } from '../common/pagination.interface';
import { ThemeNotFoundError } from './theme-not-found-error';
import { ThemeHasQuestionsError } from './theme-has-questions-error';
import { TokenValidator } from '../authentication/token-validator.interface';
import authenticationMiddleware from '../authentication/authentication-middleware';
import { TokenDecoder } from '../authentication/token-decoder.interface';
import { DecodedToken } from '../authentication/decoded-token.interface';
import { UserRole } from '../users/user-role';

let app: FastifyInstance;
let mockThemeService: ThemeService;
let mockUuidValidator: UuidValidator;
let mockTokenValidator: TokenValidator;
let mockTokenDecoder: TokenDecoder;
let mockMiddleware: (app: FastifyInstance, options: { tokenValidator: TokenValidator }) => Promise<void>;
beforeEach(() => {
    mockThemeService = {
        createTheme: vi.fn().mockReturnValue({ id: '019d92d2-e1f6-7d05-9803-3948dbc4c416', name: 'Culture générale', created_at: new Date().toISOString(), last_updated_at: null } as Theme),
        updateTheme: vi.fn().mockReturnValue({ id: '019d92d2-e1f6-7d05-9803-3948dbc4c416', name: 'Culture générale 2', created_at: new Date().toISOString(), last_updated_at: new Date().toISOString() } as Theme),
        deleteTheme: vi.fn(),
        getById: vi.fn().mockReturnValue({ id: '019d92d2-e1f6-7d05-9803-3948dbc4c416', name: 'Culture générale', created_at: new Date().toISOString(), last_updated_at: null } as Theme),
        getAll: vi.fn().mockReturnValue({
            data: [{
                id: "019d9aa3-bfb7-7eaf-af2a-739ed8e0a2a6",
                name: "First Theme",
                created_at: "2026-04-17T10:56:00Z",
                last_updated_at: null
            },
            {
                id: "019d9aa8-4660-77f7-8766-2d26115ee22f",
                name: "Second Theme",
                created_at: "2026-04-17T10:57:00Z",
                last_updated_at: null
            },
            {
                id: "019d9aa9-265f-7a16-b11b-6dcf9f1a4df1",
                name: "Third Theme",
                created_at: "2026-04-17T10:58:00Z",
                last_updated_at: "2026-04-17T10:59:00Z"
            }],
            limit: 3,
            page: 1,
            total: 6,
            total_pages: 2
        } as Pagination<Theme>)
    };
    mockUuidValidator = {
        validate: vi.fn().mockReturnValue(true)
    };
    mockTokenValidator = {
        validateToken: vi.fn().mockReturnValue(true)
    };
    mockTokenDecoder = {
        decode: vi.fn().mockReturnValue({ role: UserRole.ADMIN } as DecodedToken)
    };
    mockMiddleware = async (app, options) => { };
    app = Fastify();
    app.register(themeRoute, { themeService: mockThemeService, uuidValidator: mockUuidValidator, tokenValidator: mockTokenValidator, tokenDecoder: mockTokenDecoder, middleware: mockMiddleware, maxRequestsPerMinute: 60 });
});

describe('US-004/CA-01 - Create Theme', () => {
    it('should create a new theme successfully', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/themes',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Culture générale' })
        });
        expect(response.statusCode).toBe(201);
        expect(response.json()).toEqual({ id: '019d92d2-e1f6-7d05-9803-3948dbc4c416', name: 'Culture générale', created_at: expect.any(String), last_updated_at: null });
        expect(mockThemeService.createTheme).toHaveBeenCalledWith('Culture générale');
    });
});

describe('US-004/CA-02 - Create Theme with invalid name', () => {
    it('should return a validation error for invalid theme name', async () => {
        mockThemeService.createTheme = vi.fn().mockImplementation(() => { throw new ValidationError(); });
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/themes',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Invalid@Name!' })
        });
        expect(response.statusCode).toBe(400);
        expect(response.json()).toEqual({ error: 'VALIDATION_ERROR' });
        expect(mockThemeService.createTheme).toHaveBeenCalledWith('Invalid@Name!');
    });
});

describe('US-004/CA-04 - Create Theme with existing name', () => {
    it('should return a conflict error for existing theme name', async () => {
        mockThemeService.createTheme = vi.fn().mockImplementation(() => { throw new ConflictError(); });
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/themes',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: 'Culture générale' })
        });
        expect(response.statusCode).toBe(409);
        expect(response.json()).toEqual({ error: 'THEME_ALREADY_EXISTS' });
        expect(mockThemeService.createTheme).toHaveBeenCalledWith('Culture générale');
    });
});

describe("US-004/CA-07 - Unknown fields", () => {
    it("should return an error 400 with a mispelled property", async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/themes',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ nem: 'Histoire' })
        });
        expect(response.statusCode).toBe(400);
        expect(response.json()).toEqual({ error: 'UNKNOWN_FIELDS' });
        expect(mockThemeService.createTheme).not.toHaveBeenCalled();
    });
    it("should return an error 400 with an unknown property", async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/themes',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: 'Histoire', color: 'Red' })
        });
        expect(response.statusCode).toBe(400);
        expect(response.json()).toEqual({ error: 'UNKNOWN_FIELDS' });
        expect(mockThemeService.createTheme).not.toHaveBeenCalled();
    });
});

describe("US-004/CA-08 - Wrong content-type", () => {
    it("should return a 415 error code", async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/themes',
            headers: { 'content-type': 'application/xml' },
            body: JSON.stringify({ name: 'Histoire' })
        });
        expect(response.statusCode).toBe(415);
        expect(response.json()).toEqual({ code: 'FST_ERR_CTP_INVALID_MEDIA_TYPE', error: 'Unsupported Media Type', message: 'Unsupported Media Type', statusCode: 415 });
        expect(mockThemeService.createTheme).not.toHaveBeenCalled();
    });
});

describe("US-004/CA-09 - Retrieve a theme by its ID", () => {
    it("should return a 200 HTML code", async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/themes/019d92d2-e1f6-7d05-9803-3948dbc4c416',
            headers: { 'content-type': 'application/json' }
        });
        expect(response.statusCode).toBe(200);
    });
});

describe("US-004/CA-10 - Inexisting theme", () => {
    it("should return a 404 HTML code", async () => {
        mockThemeService.getById = vi.fn().mockImplementation(() => { return undefined });
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/themes/019d92d2-e1f6-7d05-9803-3948dbc4c416',
            headers: { 'content-type': 'application/json' }
        });
        expect(response.statusCode).toBe(404);
    });
});

describe("US-004/CA-11 - Wrong format for UUID", () => {
    it("should return a 400 HTML code", async () => {
        mockThemeService.getById = vi.fn().mockImplementation(() => { return { id: '1', name: 'Culture générale', created_at: new Date().toISOString(), last_updated_at: null } as Theme });
        mockUuidValidator.validate = vi.fn().mockReturnValue(false);
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/themes/1',
            headers: { 'content-type': 'application/json' }
        });
        expect(response.statusCode).toBe(400);
    });
});

describe("US-004/CA-13 - Get all themes with pagination", () => {
    it("should return 200 with the first theme", async () => {
        mockThemeService.getAll = vi.fn().mockImplementation(() => {
            return {
                data: [{
                    id: "019d9aa3-bfb7-7eaf-af2a-739ed8e0a2a6",
                    name: "First Theme",
                    created_at: "2026-04-17T10:56:00Z",
                    last_updated_at: null
                }],
                limit: 1,
                page: 1,
                total: 6,
                total_pages: 3
            } as Pagination<Theme>
        });
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/themes?page=1&limit=1',
            headers: { 'content-type': 'application/json' }
        });
        expect(response.statusCode).toBe(200);
    });
    it("should return the two first themes", async () => {
        mockThemeService.getAll = vi.fn().mockImplementation(() => {
            return {
                data: [{
                    id: "019d9aa3-bfb7-7eaf-af2a-739ed8e0a2a6",
                    name: "First Theme",
                    created_at: "2026-04-17T10:56:00Z",
                    last_updated_at: null
                },
                {
                    id: "019d9aa8-4660-77f7-8766-2d26115ee22f",
                    name: "Second Theme",
                    created_at: "2026-04-17T10:57:00Z",
                    last_updated_at: null
                }],
                limit: 2,
                page: 1,
                total: 6,
                total_pages: 3
            } as Pagination<Theme>
        });
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/themes?page=1&limit=2',
            headers: { 'content-type': 'application/json' }
        });
        expect(response.statusCode).toBe(200);
    });
});

describe("US-004/CA-15 - Parameters of pagination set by default", () => {
    it("should send page 1 and limit 20 by default", async () => {
        mockThemeService.getAll = vi.fn().mockImplementation(() => {
            return {
                data: [{
                    id: "019d9aa3-bfb7-7eaf-af2a-739ed8e0a2a6",
                    name: "First Theme",
                    created_at: "2026-04-17T10:56:00Z",
                    last_updated_at: null
                }],
                limit: 1,
                page: 1,
                total: 6,
                total_pages: 3
            } as Pagination<Theme>
        });
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/themes',
            headers: { 'content-type': 'application/json' }
        });
        expect(response.statusCode).toBe(200);
        expect(mockThemeService.getAll).toHaveBeenCalledWith(1, 20);
    });
});

describe("US-004/CA-16 - Limit must be equal or less than 100", () => {
    it("should send a 400 error code", async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/themes?limit=101',
            headers: { 'content-type': 'application/json' }
        });
        expect(response.statusCode).toBe(400);
        expect(response.json()).toEqual({ error: 'INVALID_PAGINATION' });
    });
});

describe("US-004/CA-17 - When pagination parameters are invalid", () => {
    it("should send a 400 error code - negative page", async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/themes?page=-1',
            headers: { 'content-type': 'application/json' }
        });
        expect(response.statusCode).toBe(400);
        expect(response.json()).toEqual({ error: 'INVALID_PAGINATION' });
    });
    it("should send a 400 error code - negative limit", async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/themes?limit=-1',
            headers: { 'content-type': 'application/json' }
        });
        expect(response.statusCode).toBe(400);
        expect(response.json()).toEqual({ error: 'INVALID_PAGINATION' });
    });
    it("should send a 400 error code - 0 page", async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/themes?page=0',
            headers: { 'content-type': 'application/json' }
        });
        expect(response.statusCode).toBe(400);
        expect(response.json()).toEqual({ error: 'INVALID_PAGINATION' });
    });
    it("should send a 400 error code - 0 limit", async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/themes?limit=0',
            headers: { 'content-type': 'application/json' }
        });
        expect(response.statusCode).toBe(400);
        expect(response.json()).toEqual({ error: 'INVALID_PAGINATION' });
    });
    it("should send a 400 error code - not numeric page", async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/themes?page=A',
            headers: { 'content-type': 'application/json' }
        });
        expect(response.statusCode).toBe(400);
        expect(response.json()).toEqual({ error: 'INVALID_PAGINATION' });
    });
    it("should send a 400 error code - not numeric limit", async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/themes?limit=B',
            headers: { 'content-type': 'application/json' }
        });
        expect(response.statusCode).toBe(400);
        expect(response.json()).toEqual({ error: 'INVALID_PAGINATION' });
    });
});

describe("US-004/CA-19a - Wrong content-type", () => {
    it("should return a 200 HTML code", async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/themes?page=1&limit=1',
            headers: { 'content-type': 'application/xml' }
        });
        expect(response.statusCode).toBe(200);
    });
});

describe("US-004/CA-20 - Update an existing theme", () => {
    it('should update the theme successfully', async () => {
        const response = await app.inject({
            method: 'PUT',
            url: '/api/v1/themes/019d92d2-e1f6-7d05-9803-3948dbc4c416',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: "019d92d2-e1f6-7d05-9803-3948dbc4c416", name: "Culture générale 2" })
        });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ id: '019d92d2-e1f6-7d05-9803-3948dbc4c416', name: 'Culture générale 2', created_at: expect.any(String), last_updated_at: expect.any(String) });
        expect(mockThemeService.updateTheme).toHaveBeenCalledWith('019d92d2-e1f6-7d05-9803-3948dbc4c416', 'Culture générale 2');
    });
});

describe("US-004/CA-21 - Format an existing theme", () => {
    it("should trim the new name", async () => {
        mockThemeService.updateTheme = vi.fn().mockImplementation(() => { throw new ValidationError(); });
        const response = await app.inject({
            method: 'PUT',
            url: '/api/v1/themes/019d92d2-e1f6-7d05-9803-3948dbc4c416',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: "019d92d2-e1f6-7d05-9803-3948dbc4c416", name: "Culture générale avec un nom beaucoup trop long que ce qui est autorisé" })
        });
        expect(response.statusCode).toBe(400);
        expect(response.json()).toEqual({ error: 'VALIDATION_ERROR' });
        expect(mockThemeService.updateTheme).toHaveBeenCalledWith("019d92d2-e1f6-7d05-9803-3948dbc4c416", "Culture générale avec un nom beaucoup trop long que ce qui est autorisé");
    });
});

describe('US-004/CA-21 - Update Theme with other existing name', () => {
    it('should return a conflict error for existing theme name', async () => {
        mockThemeService.updateTheme = vi.fn().mockImplementation(() => { throw new ConflictError(); });
        const response = await app.inject({
            method: 'PUT',
            url: '/api/v1/themes/019d92d2-e1f6-7d05-9803-3948dbc4c416',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: '019d92d2-e1f6-7d05-9803-3948dbc4c416', name: 'Un nom de thème qui existe déjà' })
        });
        expect(response.statusCode).toBe(409);
        expect(response.json()).toEqual({ error: 'THEME_ALREADY_EXISTS' });
        expect(mockThemeService.updateTheme).toHaveBeenCalledWith('019d92d2-e1f6-7d05-9803-3948dbc4c416', 'Un nom de thème qui existe déjà');
    });
});

describe("US-004/CA-23 - Id should be the same in body and url", () => {
    it("should return a id_mismatch error", async () => {
        const response = await app.inject({
            method: 'PUT',
            url: '/api/v1/themes/019d92d2-e1f6-7d05-9803-3948dbc4c416',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: '019da051-e379-74e7-b446-65518f88cc3a', name: 'Un nom de thème qui existe déjà' })
        });
        expect(response.statusCode).toBe(400);
        expect(response.json()).toEqual({ error: 'ID_MISMATCH' });
    });
});

describe("US-004/CA-25 - Unknown id", () => {
    it("should return a not found error", async () => {
        mockThemeService.updateTheme = vi.fn().mockImplementation(() => { throw new ThemeNotFoundError(); });
        const response = await app.inject({
            method: 'PUT',
            url: '/api/v1/themes/019d92d2-e1f6-7d05-9803-3948dbc4c416',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: '019d92d2-e1f6-7d05-9803-3948dbc4c416', name: 'Inconnu' })
        });
        expect(response.statusCode).toBe(404);
        expect(response.json()).toEqual({ error: 'THEME_NOT_FOUND' });
    });
});

describe("US-004/CA-26 - Wrong content-type", () => {
    it("should return a 415 error code", async () => {
        const response = await app.inject({
            method: 'PUT',
            url: '/api/v1/themes/019d92d2-e1f6-7d05-9803-3948dbc4c416',
            headers: { 'content-type': 'application/xml' },
            body: JSON.stringify({ id: '019d92d2-e1f6-7d05-9803-3948dbc4c416', name: 'Inconnu' })
        });
        expect(response.statusCode).toBe(415);
        expect(response.json()).toEqual({ code: 'FST_ERR_CTP_INVALID_MEDIA_TYPE', error: 'Unsupported Media Type', message: 'Unsupported Media Type', statusCode: 415 });
        expect(mockThemeService.createTheme).not.toHaveBeenCalled();
    });
});

describe("US-004/CA-27 - Unknown fields", () => {
    it("should return an error 400 with a mispelled property", async () => {
        const response = await app.inject({
            method: 'PUT',
            url: '/api/v1/themes/019d92d2-e1f6-7d05-9803-3948dbc4c416',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: '019d92d2-e1f6-7d05-9803-3948dbc4c416', nem: 'Inconnu' })
        });
        expect(response.statusCode).toBe(400);
        expect(response.json()).toEqual({ error: 'UNKNOWN_FIELDS' });
        expect(mockThemeService.createTheme).not.toHaveBeenCalled();
    });
    it("should return an error 400 with an unknown property", async () => {
        const response = await app.inject({
            method: 'PUT',
            url: '/api/v1/themes/019d92d2-e1f6-7d05-9803-3948dbc4c416',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: '019d92d2-e1f6-7d05-9803-3948dbc4c416', name: 'Inconnu', active: false })
        });
        expect(response.statusCode).toBe(400);
        expect(response.json()).toEqual({ error: 'UNKNOWN_FIELDS' });
        expect(mockThemeService.createTheme).not.toHaveBeenCalled();
    });
});

describe("US-004/CA-28 - Delete route", () => {
    it("should return a 204 code", async () => {
        const response = await app.inject({
            method: 'DELETE',
            url: '/api/v1/themes/019d92d2-e1f6-7d05-9803-3948dbc4c416'
        });
        expect(response.statusCode).toBe(204);
        expect(mockThemeService.deleteTheme).toHaveBeenCalled();
    });
    it("should ignore the body", async () => {
        const response = await app.inject({
            method: 'DELETE',
            url: '/api/v1/themes/019d92d2-e1f6-7d05-9803-3948dbc4c416',
            body: JSON.stringify({ id: '019d92d2-e1f6-7d05-9803-3948dbc4c416', name: 'Inconnu', active: false }),
            headers: { 'content-type': 'application/json' }
        });
        expect(response.statusCode).toBe(204);
        expect(mockThemeService.deleteTheme).toHaveBeenCalled();
    });
    it("should ignore the content type", async () => {
        const response = await app.inject({
            method: 'DELETE',
            url: '/api/v1/themes/019d92d2-e1f6-7d05-9803-3948dbc4c416',
            headers: { 'content-type': 'application/json' }
        });
        expect(response.statusCode).toBe(204);
        expect(mockThemeService.deleteTheme).toHaveBeenCalled();
    });
});

describe("US-004/CA-29 - Delete unfound theme", () => {
    it("should return a 404 not found error", async () => {
        mockThemeService.deleteTheme = vi.fn().mockImplementation(() => { throw new ThemeNotFoundError(); });
        const response = await app.inject({
            method: 'DELETE',
            url: '/api/v1/themes/019d92d2-e1f6-7d05-9803-3948dbc4c416'
        });
        expect(response.statusCode).toBe(404);
        expect(response.json()).toEqual({ error: 'THEME_NOT_FOUND' });
    });
});

describe("US-004/CA-30 - Delete theme with questions", () => {
    it("should return a 409 error", async () => {
        mockThemeService.deleteTheme = vi.fn().mockImplementation(() => { throw new ThemeHasQuestionsError(); });
        const response = await app.inject({
            method: 'DELETE',
            url: '/api/v1/themes/019d92d2-e1f6-7d05-9803-3948dbc4c416'
        });
        expect(response.statusCode).toBe(409);
        expect(response.json()).toEqual({ error: 'THEME_HAS_QUESTIONS' });
    });
});

describe("US-004/CA-32 - Request without authorization", () => {
    beforeEach(() => {
        app = Fastify();
        app.register(themeRoute, { themeService: mockThemeService, uuidValidator: mockUuidValidator, tokenValidator: mockTokenValidator, tokenDecoder: mockTokenDecoder, middleware: authenticationMiddleware, maxRequestsPerMinute: 60 });
    });
    it("should return a 401 error", async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/v1/themes/019d92d2-e1f6-7d05-9803-3948dbc4c416',
            headers: { 'content-type': 'application/json' }
        });
        expect(response.statusCode).toBe(401);
    });
});

describe('US-004/CA-34: When rate limit is exceeded', () => {
    beforeEach(() => {
        app = Fastify();
        app.register(themeRoute, { themeService: mockThemeService, uuidValidator: mockUuidValidator, tokenValidator: mockTokenValidator, tokenDecoder: mockTokenDecoder, middleware: mockMiddleware, maxRequestsPerMinute: 5 });
    });
    it('should return 429', async () => {
        for (let i = 0; i < 5; i++) {
            await app.inject({
                method: 'POST',
                url: '/api/v1/themes',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Culture générale ' + i.toString() })
            });
        }
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/themes',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Culture générale 6' })
        });
        expect(response.statusCode).toBe(429);
    });
});

describe("US-004/CA-36 - Unexpected error", () => {
    it("should return a 500 error", async () => {
        mockThemeService.updateTheme = vi.fn().mockImplementation(() => { throw new Error(); });
        const response = await app.inject({
            method: 'PUT',
            url: '/api/v1/themes/019d92d2-e1f6-7d05-9803-3948dbc4c416',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: '019d92d2-e1f6-7d05-9803-3948dbc4c416', name: 'Inconnu' })
        });
        expect(response.statusCode).toBe(500);
        expect(response.json()).toEqual({ error: 'INTERNAL_SERVER_ERROR' });
    });
});