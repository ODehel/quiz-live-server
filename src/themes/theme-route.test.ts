import Fastify, { FastifyInstance } from 'fastify';
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Theme } from './theme.interface';
import { ThemeService } from './theme-service.interface';
import themeRoute from './theme-route';
import { ValidationError } from './validation-error';
import { ConflictError } from './conflict-error';
import { UuidValidator } from '../common/uuid-validator.interface';
import { Pagination } from '../common/pagination.interface';

let app: FastifyInstance;
let mockThemeService: ThemeService;
let mockUuidValidator: UuidValidator;
beforeEach(() => {
    mockThemeService = {
        createTheme: vi.fn().mockReturnValue({ id: '019d92d2-e1f6-7d05-9803-3948dbc4c416', name: 'Culture générale', created_at: new Date().toISOString(), last_updated_at: null } as Theme),
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
    app = Fastify();
    app.register(themeRoute, { themeService: mockThemeService, uuidValidator: mockUuidValidator });
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