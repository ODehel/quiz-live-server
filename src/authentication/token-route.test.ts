import Fastify, { FastifyInstance } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticationService } from "./authentication-service.interface";
import { TokenGenerator } from "./token-generator.interface";
import { UserRole } from "../users/user-role";
import { Token } from "./token.interface";
import tokenRoute from "../authentication/token-route";

let app: FastifyInstance;
let mockAuthenticationService: AuthenticationService;
let mockTokenGenerator: TokenGenerator;
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
    app = Fastify();
    await app.register(tokenRoute, { authenticationService: mockAuthenticationService, tokenGenerator: mockTokenGenerator });
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

    it('should return the native Fastify body, not a custom one', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/token',
            headers: { 'Content-Type': 'application/xml' },
            body: '<root><username>User Name</username><password>user-password</password></root>'
        })
        expect(response.json()).toEqual({ code: 'FST_ERR_CTP_INVALID_MEDIA_TYPE', error: 'Unsupported Media Type', message: 'Unsupported Media Type', statusCode: 415 });
    });

    it('should return the native 415 for a text/plain body, not a validation error', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/token',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ username: 'User Name', password: 'user-password' })
        })
        expect(response.statusCode).toBe(415)
        expect(response.json()).toEqual({ code: 'FST_ERR_CTP_INVALID_MEDIA_TYPE', error: 'Unsupported Media Type', message: 'Unsupported Media Type', statusCode: 415 });
    });

    const nativeUnsupportedMediaType = { code: 'FST_ERR_CTP_INVALID_MEDIA_TYPE', error: 'Unsupported Media Type', message: 'Unsupported Media Type', statusCode: 415 };

    it('US-003/CA-7 should return the native 415 when the Content-Type header is absent and the body is empty', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/token'
        })
        expect(response.statusCode).toBe(415)
        expect(response.json()).toEqual(nativeUnsupportedMediaType);
        expect(mockAuthenticationService.authenticate).not.toHaveBeenCalled();
    });

    it('US-003/CA-7 should return the native 415 when the Content-Type header is absent and the body is not empty', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/token',
            body: JSON.stringify({ username: 'User Name', password: 'user-password' })
        })
        expect(response.statusCode).toBe(415)
        expect(response.json()).toEqual(nativeUnsupportedMediaType);
        expect(mockAuthenticationService.authenticate).not.toHaveBeenCalled();
    });

    it.each([
        ['empty', undefined],
        ['not empty', JSON.stringify({ username: 'User Name', password: 'user-password' })]
    ])('US-003/CA-7 should return the native 415 when the Content-Type header is present but empty and the body is %s', async (_label, body) => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/token',
            headers: { 'Content-Type': '' },
            body
        })
        expect(response.statusCode).toBe(415)
        expect(response.json()).toEqual(nativeUnsupportedMediaType);
        expect(mockAuthenticationService.authenticate).not.toHaveBeenCalled();
    });

    it.each([
        'application/json; charset=iso-8859-1',
        'application/json; charset=utf-16',
        'Application/JSON; CHARSET=ISO-8859-1'
    ])('US-003/CA-7 should return the native 415 when the Content-Type is %s', async (contentType) => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/token',
            headers: { 'Content-Type': contentType },
            body: JSON.stringify({ username: 'User Name', password: 'user-password' })
        })
        expect(response.statusCode).toBe(415)
        expect(response.json()).toEqual(nativeUnsupportedMediaType);
        expect(mockAuthenticationService.authenticate).not.toHaveBeenCalled();
    });

    it.each([
        'application/json; charset=utf-8',
        'application/json;charset=utf-8',
        'application/json; charset=UTF-8',
        'APPLICATION/JSON; CHARSET=UTF-8',
        'application/json; charset="utf-8"',
        'application/json; foo=bar; charset=utf-8',
        'application/json; charset=utf-8 ; foo=bar',
        'Application/JSON',
        'application/json; foo=bar'
    ])('US-003/CA-7 should accept the Content-Type %s', async (contentType) => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/token',
            headers: { 'Content-Type': contentType },
            body: JSON.stringify({ username: 'User Name', password: 'user-password' })
        })
        expect(response.statusCode).toBe(200)
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

const postToken = (body: unknown) => app.inject({
    method: 'POST',
    url: '/api/v1/token',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
});

describe('US-003/CA-09 and CA-10 (decision #84, rank 5 before rank 6): With a missing or empty field and an unknown field', () => {
    it.each([
        ['username is missing', { password: 'user-password', extra: 1 }, 'Username is required.'],
        ['username is empty', { username: '', password: 'user-password', extra: 1 }, 'Username is required.'],
        ['username is null', { username: null, password: 'user-password', extra: 1 }, 'Username is required.'],
        ['password is missing', { username: 'User Name', extra: 1 }, 'Password is required.'],
        ['password is empty', { username: 'User Name', password: '', extra: 1 }, 'Password is required.'],
        ['password is null', { username: 'User Name', password: null, extra: 1 }, 'Password is required.']
    ])('should return the VALIDATION_ERROR of the field, not UNKNOWN_FIELDS, when %s', async (_label, body, message) => {
        const response = await postToken(body);
        expect(response.statusCode).toBe(400);
        expect(response.json()).toEqual({ status: 400, error: 'VALIDATION_ERROR', message });
        expect(mockAuthenticationService.authenticate).not.toHaveBeenCalled();
    });
});

describe('US-003/CA-09 and CA-10 (decision #85, rank 4): With a field that is not a string', () => {
    it.each([
        ['a number', 42],
        ['a boolean', true],
        ['an array', ['User Name']],
        ['an object', { name: 'User Name' }]
    ])('should return 400 VALIDATION_ERROR "Username must be a string." when the username is %s', async (_label, username) => {
        const response = await postToken({ username, password: 'user-password' });
        expect(response.statusCode).toBe(400);
        expect(response.json()).toEqual({ status: 400, error: 'VALIDATION_ERROR', message: 'Username must be a string.' });
        expect(mockAuthenticationService.authenticate).not.toHaveBeenCalled();
    });

    it.each([
        ['a number', 42],
        ['a boolean', false],
        ['an array', ['user-password']],
        ['an object', { value: 'user-password' }]
    ])('should return 400 VALIDATION_ERROR "Password must be a string." when the password is %s', async (_label, password) => {
        const response = await postToken({ username: 'User Name', password });
        expect(response.statusCode).toBe(400);
        expect(response.json()).toEqual({ status: 400, error: 'VALIDATION_ERROR', message: 'Password must be a string.' });
        expect(mockAuthenticationService.authenticate).not.toHaveBeenCalled();
    });

    it('should name the username only when both fields are not strings', async () => {
        const response = await postToken({ username: 42, password: 42 });
        expect(response.json()).toEqual({ status: 400, error: 'VALIDATION_ERROR', message: 'Username must be a string.' });
    });

    it('should report the type of the username before the password that is missing', async () => {
        const response = await postToken({ username: 42 });
        expect(response.json()).toEqual({ status: 400, error: 'VALIDATION_ERROR', message: 'Username must be a string.' });
    });

    it('should report the type of the password before the username that is missing', async () => {
        const response = await postToken({ password: 42 });
        expect(response.json()).toEqual({ status: 400, error: 'VALIDATION_ERROR', message: 'Password must be a string.' });
    });

    it('should report the type of the password before the username that is empty', async () => {
        const response = await postToken({ username: '', password: 42 });
        expect(response.json()).toEqual({ status: 400, error: 'VALIDATION_ERROR', message: 'Password must be a string.' });
    });

    it('should report the type of the username before the password that is empty', async () => {
        const response = await postToken({ username: 42, password: '' });
        expect(response.json()).toEqual({ status: 400, error: 'VALIDATION_ERROR', message: 'Username must be a string.' });
    });

    it('should report the type of a field before an unknown field', async () => {
        const response = await postToken({ username: 'User Name', password: 42, extra: 1 });
        expect(response.json()).toEqual({ status: 400, error: 'VALIDATION_ERROR', message: 'Password must be a string.' });
    });
});

describe('US-003/CA-09 and CA-10 (decision #86, rank 5): With a field that is null', () => {
    it.each([
        ['the username is null', { username: null, password: 'user-password' }, 'Username is required.'],
        ['the password is null', { username: 'User Name', password: null }, 'Password is required.'],
        ['both fields are null', { username: null, password: null }, 'Username is required.'],
        ['the username is null and the password is missing', { username: null }, 'Username is required.'],
        ['the password is null and the username is empty', { username: '', password: null }, 'Username is required.'],
        ['the username is missing and the password is null', { password: null }, 'Username is required.']
    ])('should return 400 VALIDATION_ERROR with the required message of the field when %s', async (_label, body, message) => {
        const response = await postToken(body);
        expect(response.statusCode).toBe(400);
        expect(response.json()).toEqual({ status: 400, error: 'VALIDATION_ERROR', message });
        expect(mockAuthenticationService.authenticate).not.toHaveBeenCalled();
    });

    it('should report the type of the password, not the null username, when the password is not a string', async () => {
        const response = await postToken({ username: null, password: 42 });
        expect(response.statusCode).toBe(400);
        expect(response.json()).toEqual({ status: 400, error: 'VALIDATION_ERROR', message: 'Password must be a string.' });
    });

    it('should report the type of the username, not the null password, when the username is not a string', async () => {
        const response = await postToken({ username: 42, password: null });
        expect(response.json()).toEqual({ status: 400, error: 'VALIDATION_ERROR', message: 'Username must be a string.' });
    });
});

describe('US-003/CA-09 and CA-10 (decision #85, rank 5): With both the username and the password missing or empty', () => {
    it.each([
        ['both fields are missing', {}],
        ['both fields are empty', { username: '', password: '' }]
    ])('should return 400 VALIDATION_ERROR naming the username only when %s', async (_label, body) => {
        const response = await postToken(body);
        expect(response.statusCode).toBe(400);
        expect(response.json()).toEqual({ status: 400, error: 'VALIDATION_ERROR', message: 'Username is required.' });
        expect(mockAuthenticationService.authenticate).not.toHaveBeenCalled();
    });
});

describe('US-003/CA-09 and CA-10 (decision #85, rank 4): With a JSON body that is not an object', () => {
    it.each([
        ['null', 'null'],
        ['an array', '[]'],
        ['a non-empty array', '[{"username":"User Name","password":"user-password"}]'],
        ['a string', '"User Name"'],
        ['a number', '42'],
        ['a boolean', 'true']
    ])('should return 400 VALIDATION_ERROR "Request body must be a JSON object." when the body is %s', async (_label, body) => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/token',
            headers: { 'Content-Type': 'application/json' },
            body
        });
        expect(response.statusCode).toBe(400);
        expect(response.json()).toEqual({ status: 400, error: 'VALIDATION_ERROR', message: 'Request body must be a JSON object.' });
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

describe('US-003/CA-17: When an unexpected error occurs', () => {
    const standardBody = {
        status: 500,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred. Please try again later.'
    };

    async function postValidCredentials() {
        return app.inject({
            method: 'POST',
            url: '/api/v1/token',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'User Name', password: 'user-password' })
        });
    }

    it('should return the standard 500 body when the authentication service fails', async () => {
        vi.mocked(mockAuthenticationService.authenticate).mockRejectedValue(new Error('no such table: T_USER_USR'));
        const response = await postValidCredentials();
        expect(response.statusCode).toBe(500);
        expect(response.json()).toEqual(standardBody);
    });

    it('should return the standard 500 body when the token generation fails', async () => {
        mockTokenGenerator.generateToken = () => { throw new Error('secretOrPrivateKey must have a value'); };
        const response = await postValidCredentials();
        expect(response.statusCode).toBe(500);
        expect(response.json()).toEqual(standardBody);
    });

    it('should return the standard 500 body when the error carries a server status code', async () => {
        vi.mocked(mockAuthenticationService.authenticate).mockRejectedValue(Object.assign(new Error('database is locked'), { statusCode: 503 }));
        const response = await postValidCredentials();
        expect(response.statusCode).toBe(500);
        expect(response.json()).toEqual(standardBody);
    });

    it('should return the standard 500 body when the error carries a status code that is not an error', async () => {
        vi.mocked(mockAuthenticationService.authenticate).mockRejectedValue(Object.assign(new Error('moved elsewhere'), { statusCode: 302 }));
        const response = await postValidCredentials();
        expect(response.statusCode).toBe(500);
        expect(response.json()).toEqual(standardBody);
    });

    it('should answer the 500 with a JSON media type, whatever the charset', async () => {
        vi.mocked(mockAuthenticationService.authenticate).mockRejectedValue(new Error('no such table: T_USER_USR'));
        const response = await postValidCredentials();
        expect(response.statusCode).toBe(500);
        const mediaType = String(response.headers['content-type']).split(';')[0]?.trim().toLowerCase();
        expect(mediaType).toBe('application/json');
    });
});

describe('US-003/CA-14, US-003/CA-15 and US-003/CA-17: The server log', () => {
    const clientIp = '203.0.113.7';
    let logs: Record<string, unknown>[];

    beforeEach(async () => {
        logs = [];
        app = Fastify({
            logger: {
                level: 'info',
                stream: { write: (line: string) => { logs.push(JSON.parse(line) as Record<string, unknown>); } }
            }
        });
        await app.register(tokenRoute, { authenticationService: mockAuthenticationService, tokenGenerator: mockTokenGenerator });
    });

    async function login(username: string, password: string) {
        return app.inject({
            method: 'POST',
            url: '/api/v1/token',
            headers: { 'Content-Type': 'application/json' },
            remoteAddress: clientIp,
            body: JSON.stringify({ username, password })
        });
    }

    // Only the content is asserted, never the shape (US-022): the lines are found by what they carry.
    function levelsOfTheLinesCarrying(username: string, ip: string): unknown[] {
        return logs
            .filter(line => Object.values(line).includes(username) && Object.values(line).includes(ip))
            .map(line => line.level);
    }

    it('US-003/CA-14: should log a successful login at INFO level with the username and the IP', async () => {
        const response = await login('User Name', 'user-password');
        expect(response.statusCode).toBe(200);
        expect(levelsOfTheLinesCarrying('User Name', clientIp)).toContain(30);
    });

    it('US-003/CA-15: should log a login with a wrong password at WARN level with the username and the IP', async () => {
        vi.mocked(mockAuthenticationService.authenticate).mockResolvedValue(undefined);
        const response = await login('User Name', 'wrong-password');
        expect(response.statusCode).toBe(401);
        expect(levelsOfTheLinesCarrying('User Name', clientIp)).toContain(40);
    });

    it('US-003/CA-15: should log a login with an unknown user at WARN level with the username tried and the IP', async () => {
        vi.mocked(mockAuthenticationService.authenticate).mockResolvedValue(undefined);
        const response = await login('Ghost', 'user-password');
        expect(response.statusCode).toBe(401);
        expect(levelsOfTheLinesCarrying('Ghost', clientIp)).toContain(40);
    });

    it('US-003/CA-14: should not log a successful login at WARN level', async () => {
        await login('User Name', 'user-password');
        expect(levelsOfTheLinesCarrying('User Name', clientIp)).not.toContain(40);
    });

    it('US-003/CA-15: should not log a failed login at INFO level', async () => {
        vi.mocked(mockAuthenticationService.authenticate).mockResolvedValue(undefined);
        await login('User Name', 'wrong-password');
        expect(levelsOfTheLinesCarrying('User Name', clientIp)).not.toContain(30);
    });

    // The error is found by what it carries (its message and its stack, anywhere in the line), never by the shape of the line (US-022).
    function errorLinesCarrying(technicalError: Error): Record<string, unknown>[] {
        const carried = (text: string) => JSON.stringify(text).slice(1, -1);
        return logs.filter(line => line.level === 50
            && JSON.stringify(line).includes(carried(technicalError.message))
            && JSON.stringify(line).includes(carried(technicalError.stack as string)));
    }

    it('US-003/CA-17: should log the error at ERROR level with its message and its stack when the authentication service fails', async () => {
        const technicalError = new Error('no such table: T_USER_USR');
        vi.mocked(mockAuthenticationService.authenticate).mockRejectedValue(technicalError);
        const response = await login('User Name', 'user-password');
        expect(response.statusCode).toBe(500);
        expect(errorLinesCarrying(technicalError)).toHaveLength(1);
    });

    it('US-003/CA-17: should log the error at ERROR level with its message and its stack when the token generation fails', async () => {
        const technicalError = new Error('secretOrPrivateKey must have a value');
        mockTokenGenerator.generateToken = () => { throw technicalError; };
        const response = await login('User Name', 'user-password');
        expect(response.statusCode).toBe(500);
        expect(errorLinesCarrying(technicalError)).toHaveLength(1);
    });

    it('US-003/CA-17: should expose neither the message nor the stack of the error in the response', async () => {
        const technicalError = new Error('no such table: T_USER_USR');
        vi.mocked(mockAuthenticationService.authenticate).mockRejectedValue(technicalError);
        const response = await login('User Name', 'user-password');
        expect(response.body).not.toContain(technicalError.message);
        expect(response.body).not.toContain('at ');
        expect(response.body).not.toContain((technicalError.stack as string).split('\n')[1]!.trim());
    });

    it('US-003/CA-17: should not log any ERROR line when the client is at fault', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/token',
            body: JSON.stringify({ username: 'User Name', password: 'user-password' })
        });
        expect(response.statusCode).toBe(415);
        expect(logs.filter(line => line.level === 50)).toEqual([]);
    });
});
