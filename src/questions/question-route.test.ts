import Fastify, { FastifyInstance } from 'fastify';
import { beforeEach, describe, expect, it, vi } from "vitest";
import questionRoute from './question-route';
import { QuestionService } from './question-service.interface';
import { Question } from './question.interface';
import { InvalidThemeError } from './invalid-theme-error';
import { ValidationError } from './validation-error';
import { ConflictError } from './conflict-error';
import authenticationMiddleware from '../authentication/authentication-middleware';
import { TokenValidator } from '../authentication/token-validator.interface';
import { TokenDecoder } from '../authentication/token-decoder.interface';

let app: FastifyInstance;
let mockQuestionService: QuestionService;
let mockTokenValidator: TokenValidator;
let mockTokenDecoder: TokenDecoder;

beforeEach(() => {
    mockQuestionService = {
        createQuestion: vi.fn().mockReturnValue({
            id: '019d92d2-e1f6-7d05-9803-3948dbc4c416',
            type: 'MCQ',
            theme_id: '018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a',
            title: 'Quelle est la capitale de la France ?',
            choices: ['Paris', 'Lyon', 'Marseille', 'Toulouse'],
            correct_answer: 'Paris',
            level: 1,
            time_limit: 30,
            points: 10,
            image_path: null,
            audio_path: null,
            created_at: new Date().toISOString(),
            last_updated_at: null
        } as Question)
    };
    mockTokenValidator = { validateToken: vi.fn(), inspectToken: vi.fn() };
    mockTokenDecoder = { decode: vi.fn() };
    const mockMiddleware = async () => { };
    app = Fastify();
    app.register(questionRoute, { questionService: mockQuestionService, tokenValidator: mockTokenValidator, tokenDecoder: mockTokenDecoder, middleware: mockMiddleware });
});

describe('US-005/CA-1 - Create an MCQ question', () => {
    it('should create a new question successfully', async () => {
        const input = {
            type: 'MCQ',
            theme_id: '018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a',
            title: 'Quelle est la capitale de la France ?',
            choices: ['Paris', 'Lyon', 'Marseille', 'Toulouse'],
            correct_answer: 'Paris',
            level: 1,
            time_limit: 30,
            points: 10
        };
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/questions',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input)
        });
        expect(response.statusCode).toBe(201);
        expect(response.json()).toEqual({
            id: '019d92d2-e1f6-7d05-9803-3948dbc4c416',
            type: 'MCQ',
            theme_id: '018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a',
            title: 'Quelle est la capitale de la France ?',
            choices: ['Paris', 'Lyon', 'Marseille', 'Toulouse'],
            correct_answer: 'Paris',
            level: 1,
            time_limit: 30,
            points: 10,
            image_path: null,
            audio_path: null,
            created_at: expect.any(String),
            last_updated_at: null
        });
        expect(mockQuestionService.createQuestion).toHaveBeenCalledWith(input);
    });
});

describe('US-005/CA-2 - Create a SPEED question', () => {
    it('should create a new SPEED question successfully', async () => {
        mockQuestionService.createQuestion = vi.fn().mockReturnValue({
            id: '019d92d2-e1f6-7d05-9803-3948dbc4c416',
            type: 'SPEED',
            theme_id: '018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a',
            title: 'Quel est le plus grand océan du monde ?',
            correct_answer: 'Pacifique',
            level: 2,
            time_limit: 15,
            points: 20,
            image_path: null,
            audio_path: null,
            created_at: new Date().toISOString(),
            last_updated_at: null
        } as Question);
        const input = {
            type: 'SPEED',
            theme_id: '018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a',
            title: 'Quel est le plus grand océan du monde ?',
            correct_answer: 'Pacifique',
            level: 2,
            time_limit: 15,
            points: 20
        };
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/questions',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input)
        });
        expect(response.statusCode).toBe(201);
        expect(response.json()).toEqual({
            id: '019d92d2-e1f6-7d05-9803-3948dbc4c416',
            type: 'SPEED',
            theme_id: '018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a',
            title: 'Quel est le plus grand océan du monde ?',
            correct_answer: 'Pacifique',
            level: 2,
            time_limit: 15,
            points: 20,
            image_path: null,
            audio_path: null,
            created_at: expect.any(String),
            last_updated_at: null
        });
        expect(mockQuestionService.createQuestion).toHaveBeenCalledWith(input);
    });
});

describe('US-005/CA-5 - Reject a question whose title is already taken', () => {
    it('should translate a ConflictError into a 409 QUESTION_ALREADY_EXISTS response', async () => {
        mockQuestionService.createQuestion = vi.fn(() => {
            throw new ConflictError();
        });

        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/questions',
            payload: {
                type: 'MCQ',
                theme_id: '018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a',
                title: 'QUELLE EST LA CAPITALE DE LA FRANCE ?',
                choices: ['Paris', 'Lyon', 'Marseille', 'Toulouse'],
                correct_answer: 'Paris',
                level: 1,
                time_limit: 30,
                points: 10
            }
        });

        expect(response.statusCode).toBe(409);
        expect(response.json()).toEqual({
            status: 409,
            error: 'QUESTION_ALREADY_EXISTS',
            message: 'A question with this title already exists.'
        });
    });
});

describe('US-005/CA-6 - Reject a question with an invalid type', () => {
    it('should reject a question whose type is neither MCQ nor SPEED', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/questions',
            payload: {
                type: 'OPEN',
                theme_id: '018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a',
                title: 'Qui a peint la Joconde ?',
                correct_answer: 'Léonard de Vinci',
                level: 3,
                time_limit: 30,
                points: 10
            }
        });

        expect(response.statusCode).toBe(400);
        expect(mockQuestionService.createQuestion).not.toHaveBeenCalled();
    });
});

describe('US-005/CA-8 - Reject a question with a malformed theme_id', () => {
    it('should reject a question whose theme_id is not a valid UUIDv7', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/questions',
            payload: {
                type: 'SPEED',
                theme_id: 'not-a-valid-uuid',
                title: 'Qui a peint la Joconde ?',
                correct_answer: 'Léonard de Vinci',
                level: 3,
                time_limit: 30,
                points: 10
            }
        });

        expect(response.statusCode).toBe(400);
        expect(mockQuestionService.createQuestion).not.toHaveBeenCalled();
    });
});

describe('US-005/CA-7 - Reject a question referencing a non-existent theme', () => {
    it('should translate an InvalidThemeError into a 400 INVALID_THEME response', async () => {
        mockQuestionService.createQuestion = vi.fn(() => {
            throw new InvalidThemeError();
        });

        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/questions',
            payload: {
                type: 'SPEED',
                theme_id: '019d92d2-e1f6-7d05-9803-3948dbc4c416',
                title: 'Qui a peint la Joconde ?',
                correct_answer: 'Léonard de Vinci',
                level: 3,
                time_limit: 30,
                points: 10
            }
        });

        expect(response.statusCode).toBe(400);
        expect(response.json()).toEqual({
            status: 400,
            error: 'INVALID_THEME',
            message: 'The provided theme_id does not reference an existing theme.'
        });
    });
});

describe('US-005/CA-15 - Reject a question with an invalid points', () => {
    it('should translate a ValidationError into a 400 VALIDATION_ERROR response', async () => {
        mockQuestionService.createQuestion = vi.fn(() => {
            throw new ValidationError();
        });

        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/questions',
            payload: {
                type: 'SPEED',
                theme_id: '018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a',
                title: 'Quelle est la vitesse de la lumière ?',
                correct_answer: '300 000 km/s',
                level: 3,
                time_limit: 30,
                points: 100
            }
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().error).toBe('VALIDATION_ERROR');
    });
});

describe('US-005/CA-50 - Create a question without authorization', () => {
    beforeEach(() => {
        app = Fastify();
        app.register(questionRoute, { questionService: mockQuestionService, tokenValidator: mockTokenValidator, tokenDecoder: mockTokenDecoder, middleware: authenticationMiddleware });
    });
    it('should reject the creation with a 401 error', async () => {
        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/questions',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'MCQ',
                theme_id: '018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a',
                title: 'Quelle est la capitale de la France ?',
                choices: ['Paris', 'Lyon', 'Marseille', 'Toulouse'],
                correct_answer: 'Paris',
                level: 1,
                time_limit: 30,
                points: 10
            })
        });
        expect(response.statusCode).toBe(401);
        expect(mockQuestionService.createQuestion).not.toHaveBeenCalled();
    });
});

describe('US-005/CA-54 - Hide technical details of an unexpected error', () => {
    it('should translate an unexpected error into a 500 INTERNAL_SERVER_ERROR response without technical details', async () => {
        mockQuestionService.createQuestion = vi.fn(() => {
            throw new Error('SQLITE_BUSY: database is locked');
        });

        const response = await app.inject({
            method: 'POST',
            url: '/api/v1/questions',
            payload: {
                type: 'SPEED',
                theme_id: '018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a',
                title: 'Qui a peint la Joconde ?',
                correct_answer: 'Léonard de Vinci',
                level: 3,
                time_limit: 20,
                points: 15
            }
        });

        expect(response.statusCode).toBe(500);
        expect(response.json()).toEqual({
            status: 500,
            error: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected error occurred. Please try again later.'
        });
    });
});

describe('US-005/CA-54 - Log the technical details of an unexpected error', () => {
    let logLines: string[];

    beforeEach(() => {
        logLines = [];
        app = Fastify({
            logger: {
                level: 'error',
                stream: { write: (line: string) => { logLines.push(line); } }
            }
        });
        app.register(questionRoute, { questionService: mockQuestionService, tokenValidator: mockTokenValidator, tokenDecoder: mockTokenDecoder, middleware: async () => { } });
    });

    it('should log the unexpected error with its technical message at error level', async () => {
        mockQuestionService.createQuestion = vi.fn(() => {
            throw new Error('SQLITE_BUSY: database is locked');
        });

        await app.inject({
            method: 'POST',
            url: '/api/v1/questions',
            payload: {
                type: 'SPEED',
                theme_id: '018e4f5a-8c3b-7d2e-9f1a-4b5c6d7e8f9a',
                title: 'Qui a peint la Joconde ?',
                correct_answer: 'Léonard de Vinci',
                level: 3,
                time_limit: 20,
                points: 15
            }
        });

        const logs = logLines.map(line => JSON.parse(line));
        expect(logs).toContainEqual(expect.objectContaining({
            level: 50,
            err: expect.objectContaining({ message: 'SQLITE_BUSY: database is locked' })
        }));
    });
});
