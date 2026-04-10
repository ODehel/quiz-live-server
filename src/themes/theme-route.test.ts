import Fastify, { FastifyInstance } from 'fastify';
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Theme } from './theme.interface';
import { ThemeService } from './theme-service.interface';
import themeRoute from './theme-route';

let app: FastifyInstance;
let mockThemeService: ThemeService;
beforeEach(() => {
    mockThemeService = {
        createTheme: vi.fn().mockResolvedValue({ id: '1', name: 'Culture générale', created_at: new Date().toISOString(), last_updated_at: null } as Theme)
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