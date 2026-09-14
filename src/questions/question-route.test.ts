import Fastify, { FastifyInstance } from 'fastify';
import { beforeEach, describe, expect, it, vi } from "vitest";
import questionRoute from './question-route';
import { QuestionService } from './question-service.interface';
import { Question } from './question.interface';

let app: FastifyInstance;
let mockQuestionService: QuestionService;

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
    app = Fastify();
    app.register(questionRoute, { questionService: mockQuestionService });
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