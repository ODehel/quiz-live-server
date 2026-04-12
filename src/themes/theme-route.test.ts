import Fastify, { FastifyInstance } from 'fastify';
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Theme } from './theme.interface';
import { ThemeService } from './theme-service.interface';
import themeRoute from './theme-route';
import { ValidationError } from './validation-error';
import { ConflictError } from './conflict-error';

let app: FastifyInstance;
let mockThemeService: ThemeService;
beforeEach(() => {
    mockThemeService = {
        createTheme: vi.fn().mockReturnValue({ id: '1', name: 'Culture générale', created_at: new Date().toISOString(), last_updated_at: null } as Theme)
    };
    app = Fastify();
    app.register(themeRoute, { themeService: mockThemeService });
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
        expect(response.json()).toEqual({ id: '1', name: 'Culture générale', created_at: expect.any(String), last_updated_at: null });
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
            headers: { 'content-type': 'application/json'},
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