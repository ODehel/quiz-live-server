import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest'
import { QuizServer } from './quiz-server'
import { Clock } from './common/clock.interface'
import { Network } from './common/network.interface'
import { QuizServerConfiguration } from './quiz-server-configuration.interface'
import { Token } from './authentication/token.interface'
import { ThemeService } from './themes/theme-service.interface'
import { UuidValidator } from './common/uuid-validator.interface'
import { TokenValidator } from './authentication/token-validator.interface'
import { FastifyInstance } from 'fastify'
import { TokenRouteConfiguration } from './authentication/token-route-configuration.interface'
import { ThemeRouteConfiguration } from './themes/theme-route-configuration.interface'
import { TokenDecoder } from './authentication/token-decoder.interface'
import { UserRole } from './users/user-role'
import { WsRouteConfiguration } from './websocket/ws-route-configuration.interface'
import { Scheduler } from './common/scheduler.interface'
import { SubjectExtractor } from './authentication/subject-extractor.interface'
import { ParticipantResolver } from './authentication/participant-resolver.interface'
import { ExpirationExtractor } from './authentication/expiration-extractor'
import { WsEventReporter } from './websocket/ws-event-reporter.interface'
import { WsConnectionPolicy } from './websocket/ws-connection-policy'
import { QuestionService } from './questions/question-service.interface'
import { QuestionRouteConfiguration } from './questions/question-route-configuration.interface'
import SqliteDatabase, { Database } from 'better-sqlite3'
import { SqliteThemeRepository } from './themes/sqlite-theme-repository'
import { SqliteQuestionRepository } from './questions/sqlite-question-repository'
import { DefaultQuestionService } from './questions/default-question-service'
import { ThemeRepositoryExistenceChecker } from './questions/theme-repository-existence-checker'
import { Question } from './questions/question.interface'
import { DefaultThemeService } from './themes/default-theme-service'
import { Theme } from './themes/theme.interface'
import { UuidFormatValidator } from './infrastructure/uuid-format-validator'
import authenticationMiddleware from './authentication/authentication-middleware'
import rateLimitMiddleware from './infrastructure/rate-limit-middleware'

const mockClock: Clock = {
	now: () => new Date('2026-04-02T14:32:07')
}

const mockScheduler: Scheduler = {
	schedule: vi.fn(() => ({ cancel: () => { } }))
};
const mockSubjectExtractor: SubjectExtractor = {
	extract: vi.fn()
};
const mockExpirationExtractor: ExpirationExtractor = {
	extract: vi.fn()
};
const mockParticipantResolver: ParticipantResolver = {
	resolve: vi.fn()
};

const mockNetwork: Network = {
	networkInterfaces: () => ({
		'eth0': [
			{ address: '192.168.1.42', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:00', internal: false, cidr: '192.168.1.42/24' }
		]
	})
}

const port: number = 3000

const mockQuizServerConfiguration: QuizServerConfiguration = {
	clock: mockClock,
	network: mockNetwork,
	port: port,
	rateLimitMiddleware: async (app) => { await rateLimitMiddleware(app, { maxRequestsPerMinute: 1000 }) }
}

const mockAuthenticationService = {
	authenticate: vi.fn().mockResolvedValue({ id: 'user-id', username: 'User Name', password: 'user-password', role: 'PLAYER' })
};

const mockTokenGenerator = {
	generateToken: () => {
		return { token: 'generated-token' } as Token;
	}
};

const mockTokenDecoder: TokenDecoder = {
	decode: vi.fn().mockReturnValue({ role: UserRole.PLAYER })
};

const mockThemeService: ThemeService = {
	createTheme: vi.fn(),
	deleteTheme: vi.fn(),
	getAll: vi.fn(),
	getById: vi.fn(),
	updateTheme: vi.fn()
};
const mockQuestionService: QuestionService = {
	createQuestion: vi.fn(),
	getQuestionById: vi.fn(),
	getAll: vi.fn(),
	updateQuestion: vi.fn(),
	deleteQuestion: vi.fn()
};
const mockUuidValidator: UuidValidator = {
	validate: vi.fn()
};
const mockTokenValidator: TokenValidator = {
	validateToken: vi.fn(),
	inspectToken: vi.fn()
};
const mockWsEventReporter: WsEventReporter = {
	connected: vi.fn(),
	tokenExpired: vi.fn(),
	invalidToken: vi.fn(),
	authenticationTimeout: vi.fn(),
	serverFull: vi.fn(),
	internalError: vi.fn(),
	authenticated: vi.fn(),
	disconnected: vi.fn(),
	rateLimited: vi.fn()
};
const mockMiddleware: (app: FastifyInstance, options: { tokenValidator: TokenValidator }) => Promise<void> = async () => { };
const mockRateLimitMiddleware: (app: FastifyInstance) => Promise<void> = async () => { };

const mockTokenRouteConfiguration: TokenRouteConfiguration = {
	authenticationService: mockAuthenticationService,
	tokenGenerator: mockTokenGenerator,
	rateLimitMiddleware: mockRateLimitMiddleware
};

const mockThemeRouteConfiguration: ThemeRouteConfiguration = {
	themeService: mockThemeService,
	uuidValidator: mockUuidValidator,
	tokenValidator: mockTokenValidator,
	tokenDecoder: mockTokenDecoder,
	middleware: mockMiddleware,
	rateLimitMiddleware: mockRateLimitMiddleware
};

const mockWsRouteConfiguration: WsRouteConfiguration = {
	tokenValidator: mockTokenValidator,
	scheduler: mockScheduler,
	subjectExtractor: mockSubjectExtractor,
	participantResolver: mockParticipantResolver,
	expirationExtractor: mockExpirationExtractor,
	clock: mockClock,
	wsEventReporter: mockWsEventReporter,
	wsConnectionPolicy: new WsConnectionPolicy(),
	maxConnections: 10
};

const mockQuestionRouteConfiguration: QuestionRouteConfiguration = {
	tokenValidator: mockTokenValidator,
	tokenDecoder: mockTokenDecoder,
	questionService: mockQuestionService,
	middleware: mockMiddleware,
	rateLimitMiddleware: mockRateLimitMiddleware
}

describe('CA-1 - Le serveur démarre sans erreur', () => {
	let server: QuizServer
	beforeEach(() => {
		server = new QuizServer(mockQuizServerConfiguration, mockTokenRouteConfiguration, mockThemeRouteConfiguration, mockWsRouteConfiguration, mockQuestionRouteConfiguration);
	})
	it('should start and remain listening without error', async () => {
		await server.start()
		const response = await server.inject('/health')
		expect(response.statusCode).toBe(200)
	})
	afterEach(async () => {
		await server.stop()
	})
})

describe('CA-2 - La console affiche l`heure de lancement', () => {
	let server: QuizServer
	let spy: MockInstance<typeof console.log>
	beforeEach(() => {
		spy = vi.spyOn(console, 'log')
		server = new QuizServer(mockQuizServerConfiguration, mockTokenRouteConfiguration, mockThemeRouteConfiguration, mockWsRouteConfiguration, mockQuestionRouteConfiguration);
	})
	it('should display a message with current hour within console', async () => {
		await server.start()
		expect(spy).toHaveBeenCalledWith('🚀 Server started at 14:32:07')
	})
	afterEach(async () => {
		await server.stop()
	})
})

describe('CA-3 - La console affiche l`adresse IP et le port', () => {
	let server: QuizServer
	let spy: MockInstance<typeof console.log>
	beforeEach(() => {
		spy = vi.spyOn(console, 'log')
		server = new QuizServer(mockQuizServerConfiguration, mockTokenRouteConfiguration, mockThemeRouteConfiguration, mockWsRouteConfiguration, mockQuestionRouteConfiguration);
	})
	it('should display a message with current hour within console', async () => {
		await server.start()
		expect(spy).toHaveBeenCalledWith('📡 Listening on http://192.168.1.42:3000')
	})
	afterEach(async () => {
		await server.stop()
	})
})

describe('CA-4 - Message de fallback si pas d`adresse IP trouvée', () => {
	let server: QuizServer
	let spy: MockInstance<typeof console.log>
	beforeEach(() => {
		spy = vi.spyOn(console, 'log')
		const mockNetworkNoIP: Network = {
			networkInterfaces: () => ({})
		}
		const configWithNoIP: QuizServerConfiguration = {
			...mockQuizServerConfiguration,
			network: mockNetworkNoIP
		}
		server = new QuizServer(configWithNoIP, mockTokenRouteConfiguration, mockThemeRouteConfiguration, mockWsRouteConfiguration, mockQuestionRouteConfiguration);
	})
	it('should display a fallback message if no IP address is found', async () => {
		await server.start()
		expect(spy).toHaveBeenCalledWith('⚠️ No network interface found, listening on http://localhost:3000')
	})
	afterEach(async () => {
		await server.stop()
	})
});

describe('US-005/CA-1 - Question creation reachable on the assembled server', () => {
	let server: QuizServer
	let creationQuestionService: QuestionService
	beforeEach(() => {
		creationQuestionService = {
			createQuestion: vi.fn().mockReturnValue({ id: '019d92d2-e1f6-7d05-9803-3948dbc4c416' }), // corps prouvé au niveau route, pas ici
			getQuestionById: vi.fn(),
			getAll: vi.fn(),
			updateQuestion: vi.fn(),
			deleteQuestion: vi.fn()
		};
		const creationRouteConfiguration: QuestionRouteConfiguration = {
			questionService: creationQuestionService,
			tokenValidator: mockTokenValidator,
			tokenDecoder: mockTokenDecoder,
			middleware: mockMiddleware, // no-op : l'authentification n'est pas l'objet de ce test
			rateLimitMiddleware: mockRateLimitMiddleware
		};
		server = new QuizServer(mockQuizServerConfiguration, mockTokenRouteConfiguration, mockThemeRouteConfiguration, mockWsRouteConfiguration, creationRouteConfiguration);
	});
	it('creates a question through the running server', async () => {
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
		await server.start()
		const response = await server.inject({
			method: 'POST',
			url: '/api/v1/questions',
			headers: { 'Content-Type': 'application/json' },
			payload: JSON.stringify(input)
		})
		expect(response.statusCode).toBe(201)
		expect(creationQuestionService.createQuestion).toHaveBeenCalledWith(input) // la config transmise est bien celle de la route
	})
	afterEach(async () => {
		await server.stop()
	});
});

describe('US-005/CA-27 - The question list is ordered most recent first on the assembled server', () => {
	const themeId = '019d6c17-1c08-7161-9358-fe4a116fa000'
	let database: Database
	let server: QuizServer
	beforeEach(() => {
		database = new SqliteDatabase(':memory:')
		new SqliteThemeRepository(database).insert({ id: themeId, name: 'Theme parent', created_at: '2026-01-01T00:00:00.000Z', last_updated_at: null })
		const questionRepository = new SqliteQuestionRepository(database)
		const aQuestion = (id: string, title: string, created_at: string): Question => ({
			id, type: 'SPEED', theme_id: themeId, title, correct_answer: 'Paris',
			level: 3, time_limit: 30, points: 10, image_path: null, audio_path: null, created_at, last_updated_at: null
		})
		// la plus ancienne est insérée en premier et porte l'id le plus grand : ni l'ordre d'insertion ni l'id seul ne donnent le bon ordre
		questionRepository.insert(aQuestion('019d6c17-1c08-7161-9358-fe4a116fa002', 'Quelle est la capitale de la France', '2026-01-01T10:00:00.000Z'))
		questionRepository.insert(aQuestion('019d6c17-1c08-7161-9358-fe4a116fa001', 'Quelle est la capitale de la Suisse', '2026-01-02T10:00:00.000Z'))
		const listingQuestionService: QuestionService = new DefaultQuestionService(
			mockClock,
			{ generate: vi.fn() }, // la création n'est pas l'objet de ce test
			questionRepository,
			{ exists: vi.fn() },
			{ validate: vi.fn() }
		)
		const listingRouteConfiguration: QuestionRouteConfiguration = {
			questionService: listingQuestionService,
			tokenValidator: mockTokenValidator,
			tokenDecoder: mockTokenDecoder,
			middleware: mockMiddleware, // no-op : l'authentification n'est pas l'objet de ce test
			rateLimitMiddleware: mockRateLimitMiddleware
		};
		server = new QuizServer(mockQuizServerConfiguration, mockTokenRouteConfiguration, mockThemeRouteConfiguration, mockWsRouteConfiguration, listingRouteConfiguration)
	})
	it('lists the most recently created question first', async () => {
		await server.start()
		const response = await server.inject({ method: 'GET', url: '/api/v1/questions' })
		expect(response.statusCode).toBe(200)
		const createdAt = response.json<{ data: Question[] }>().data.map(question => question.created_at)
		expect(createdAt).toEqual(['2026-01-02T10:00:00.000Z', '2026-01-01T10:00:00.000Z'])
	})
	afterEach(async () => {
		await server.stop()
		database.close()
	});
});

describe('US-005/CA-8 - A malformed theme_id is refused with INVALID_UUID on the assembled server', () => {
	const themeId = '019d6c17-1c08-7161-9358-fe4a116fa000'
	const questionId = '019d6c17-1c08-7161-9358-fe4a116fa001'
	const questionBody = {
		type: 'SPEED', theme_id: 'not-a-valid-uuid', title: 'Quelle est la capitale de la France',
		correct_answer: 'Paris', level: 3, time_limit: 30, points: 10
	}
	const invalidUuid = { status: 400, error: 'INVALID_UUID', message: 'The provided ID is not a valid UUID.' }
	let database: Database
	let server: QuizServer
	beforeEach(() => {
		database = new SqliteDatabase(':memory:')
		new SqliteThemeRepository(database).insert({ id: themeId, name: 'Theme parent', created_at: '2026-01-01T00:00:00.000Z', last_updated_at: null })
		const questionRepository = new SqliteQuestionRepository(database)
		questionRepository.insert({
			id: questionId, type: 'SPEED', theme_id: themeId, title: 'Quelle est la capitale de la Suisse', correct_answer: 'Berne',
			level: 3, time_limit: 30, points: 10, image_path: null, audio_path: null, created_at: '2026-01-01T10:00:00.000Z', last_updated_at: null
		})
		const realQuestionService: QuestionService = new DefaultQuestionService(
			mockClock,
			{ generate: vi.fn() },
			questionRepository,
			{ exists: vi.fn().mockReturnValue(true) },
			new UuidFormatValidator()
		)
		const realRouteConfiguration: QuestionRouteConfiguration = {
			questionService: realQuestionService,
			tokenValidator: mockTokenValidator,
			tokenDecoder: mockTokenDecoder,
			middleware: mockMiddleware, // no-op : l'authentification n'est pas l'objet de ce test
			rateLimitMiddleware: mockRateLimitMiddleware
		};
		server = new QuizServer(mockQuizServerConfiguration, mockTokenRouteConfiguration, mockThemeRouteConfiguration, mockWsRouteConfiguration, realRouteConfiguration)
	})
	it('refuses a POST whose theme_id is malformed', async () => {
		await server.start()
		const response = await server.inject({ method: 'POST', url: '/api/v1/questions', payload: JSON.stringify(questionBody), headers: { 'Content-Type': 'application/json' } })
		expect(response.statusCode).toBe(400)
		expect(response.json()).toEqual(invalidUuid)
	})
	it('refuses a PUT whose theme_id is malformed', async () => {
		await server.start()
		const response = await server.inject({ method: 'PUT', url: `/api/v1/questions/${questionId}`, payload: JSON.stringify(questionBody), headers: { 'Content-Type': 'application/json' } })
		expect(response.statusCode).toBe(400)
		expect(response.json()).toEqual(invalidUuid)
	})
	afterEach(async () => {
		await server.stop()
		database.close()
	});
});

describe('US-005/CA-35 - An unknown theme_id is refused with INVALID_THEME on PUT on the assembled server', () => {
	const themeId = '019d6c17-1c08-7161-9358-fe4a116fa000'
	const questionId = '019d6c17-1c08-7161-9358-fe4a116fa001'
	const putBody = (theme_id: string) => ({
		type: 'SPEED', theme_id, title: 'Quelle est la capitale de la Suède', correct_answer: 'Stockholm', level: 3, time_limit: 30, points: 10
	})
	const invalidTheme = { status: 400, error: 'INVALID_THEME', message: 'The provided theme_id does not reference an existing theme.' }
	let database: Database
	let server: QuizServer
	beforeEach(() => {
		database = new SqliteDatabase(':memory:')
		const themeRepository = new SqliteThemeRepository(database)
		themeRepository.insert({ id: themeId, name: 'Theme parent', created_at: '2026-01-01T00:00:00.000Z', last_updated_at: null })
		const questionRepository = new SqliteQuestionRepository(database)
		questionRepository.insert({
			id: questionId, type: 'SPEED', theme_id: themeId, title: 'Quelle est la capitale de la Suisse', correct_answer: 'Berne',
			level: 3, time_limit: 30, points: 10, image_path: null, audio_path: null, created_at: '2026-01-01T10:00:00.000Z', last_updated_at: null
		})
		const realQuestionService: QuestionService = new DefaultQuestionService(
			mockClock,
			{ generate: vi.fn() },
			questionRepository,
			new ThemeRepositoryExistenceChecker(themeRepository),
			new UuidFormatValidator()
		)
		const realRouteConfiguration: QuestionRouteConfiguration = {
			questionService: realQuestionService,
			tokenValidator: mockTokenValidator,
			tokenDecoder: mockTokenDecoder,
			middleware: mockMiddleware, // no-op : l'authentification n'est pas l'objet de ce test
			rateLimitMiddleware: mockRateLimitMiddleware
		};
		server = new QuizServer(mockQuizServerConfiguration, mockTokenRouteConfiguration, mockThemeRouteConfiguration, mockWsRouteConfiguration, realRouteConfiguration)
	})
	it('refuses a PUT whose theme_id is well formed but references no theme', async () => {
		await server.start()
		const response = await server.inject({ method: 'PUT', url: `/api/v1/questions/${questionId}`, payload: JSON.stringify(putBody('018e4f5a-0000-0000-0000-000000000000')), headers: { 'Content-Type': 'application/json' } })
		expect(response.statusCode).toBe(400)
		expect(response.json()).toEqual(invalidTheme)
	})
	it('accepts a PUT whose theme_id references an existing theme', async () => {
		await server.start()
		const response = await server.inject({ method: 'PUT', url: `/api/v1/questions/${questionId}`, payload: JSON.stringify(putBody(themeId)), headers: { 'Content-Type': 'application/json' } })
		expect(response.statusCode).toBe(200)
	})
	afterEach(async () => {
		await server.stop()
		database.close()
	});
});

describe('US-005/CA-37 - A PUT carrying the stored data leaves the question untouched on the assembled server', () => {
	const themeId = '019d6c17-1c08-7161-9358-fe4a116fa000'
	const questionId = '019d6c17-1c08-7161-9358-fe4a116fa001'
	const storedLastUpdatedAt = '2026-01-05T08:00:00.000Z'
	const putBody = (points: number) => ({
		type: 'SPEED', theme_id: themeId, title: 'Quelle est la capitale de la Suisse', correct_answer: 'Berne', level: 3, time_limit: 30, points
	})
	let database: Database
	let questionRepository: SqliteQuestionRepository
	let server: QuizServer
	beforeEach(() => {
		database = new SqliteDatabase(':memory:')
		const themeRepository = new SqliteThemeRepository(database)
		themeRepository.insert({ id: themeId, name: 'Theme parent', created_at: '2026-01-01T00:00:00.000Z', last_updated_at: null })
		questionRepository = new SqliteQuestionRepository(database)
		questionRepository.insert({
			id: questionId, type: 'SPEED', theme_id: themeId, title: 'Quelle est la capitale de la Suisse', correct_answer: 'Berne',
			level: 3, time_limit: 30, points: 10, image_path: null, audio_path: null, created_at: '2026-01-01T10:00:00.000Z', last_updated_at: storedLastUpdatedAt
		})
		const realQuestionService: QuestionService = new DefaultQuestionService(
			mockClock,
			{ generate: vi.fn() },
			questionRepository,
			new ThemeRepositoryExistenceChecker(themeRepository),
			new UuidFormatValidator()
		)
		const realRouteConfiguration: QuestionRouteConfiguration = {
			questionService: realQuestionService,
			tokenValidator: mockTokenValidator,
			tokenDecoder: mockTokenDecoder,
			middleware: mockMiddleware, // no-op : l'authentification n'est pas l'objet de ce test
			rateLimitMiddleware: mockRateLimitMiddleware
		};
		server = new QuizServer(mockQuizServerConfiguration, mockTokenRouteConfiguration, mockThemeRouteConfiguration, mockWsRouteConfiguration, realRouteConfiguration)
	})
	it('answers 200 with the question as stored and keeps last_updated_at unchanged', async () => {
		await server.start()
		const response = await server.inject({ method: 'PUT', url: `/api/v1/questions/${questionId}`, payload: JSON.stringify(putBody(10)), headers: { 'Content-Type': 'application/json' } })
		expect(response.statusCode).toBe(200)
		expect(response.json<Question>().last_updated_at).toBe(storedLastUpdatedAt)
		expect(questionRepository.getById(questionId)?.last_updated_at).toBe(storedLastUpdatedAt)
	})
	it('sets last_updated_at to now when the PUT changes a field', async () => {
		await server.start()
		const response = await server.inject({ method: 'PUT', url: `/api/v1/questions/${questionId}`, payload: JSON.stringify(putBody(20)), headers: { 'Content-Type': 'application/json' } })
		expect(response.statusCode).toBe(200)
		expect(response.json<Question>().last_updated_at).not.toBe(storedLastUpdatedAt)
		expect(questionRepository.getById(questionId)?.points).toBe(20)
	})
	afterEach(async () => {
		await server.stop()
		database.close()
	});
});

describe('US-004/CA-14- The theme list is ordered most recent first on the assembled server', () => {
	let database: Database
	let server: QuizServer
	beforeEach(() => {
		database = new SqliteDatabase(':memory:')
		const themeRepository = new SqliteThemeRepository(database)
		const aTheme = (id: string, name: string, created_at: string): Theme => ({ id, name, created_at, last_updated_at: null })
		// Fixture croisée : l'ordre voulu (Cinéma, Art, Zoologie) diffère de l'ordre d'insertion, de celui des ids
		// et de celui des noms, dans les deux sens. Aucun tri sur une seule autre colonne ne passe ce test.
		themeRepository.insert(aTheme('019d6c17-1c08-7161-9358-fe4a116fa003', 'Art', '2026-01-02T10:00:00.000Z'))
		themeRepository.insert(aTheme('019d6c17-1c08-7161-9358-fe4a116fa001', 'Zoologie', '2026-01-01T10:00:00.000Z'))
		themeRepository.insert(aTheme('019d6c17-1c08-7161-9358-fe4a116fa002', 'Cinéma', '2026-01-03T10:00:00.000Z'))
		const listingThemeService: ThemeService = new DefaultThemeService(
			mockClock,
			{ generate: vi.fn() }, // la création n'est pas l'objet de ce test
			themeRepository
		)
		const listingRouteConfiguration: ThemeRouteConfiguration = {
			themeService: listingThemeService,
			uuidValidator: mockUuidValidator,
			tokenValidator: mockTokenValidator,
			tokenDecoder: mockTokenDecoder,
			middleware: mockMiddleware, // no-op : l'authentification n'est pas l'objet de ce test
			rateLimitMiddleware: mockRateLimitMiddleware
		};
		server = new QuizServer(mockQuizServerConfiguration, mockTokenRouteConfiguration, listingRouteConfiguration, mockWsRouteConfiguration, mockQuestionRouteConfiguration)
	})
	it('lists the most recently created theme first', async () => {
		await server.start()
		const response = await server.inject({ method: 'GET', url: '/api/v1/themes' })
		expect(response.statusCode).toBe(200)
		const createdAt = response.json<{ data: Theme[] }>().data.map(theme => theme.created_at)
		expect(createdAt).toEqual(['2026-01-03T10:00:00.000Z', '2026-01-02T10:00:00.000Z', '2026-01-01T10:00:00.000Z'])
	})
	afterEach(async () => {
		await server.stop()
		database.close()
	});
});

const unknownThemeId = '019d92d2-e1f6-7d05-9803-3948dbc4c416'
const unknownThemeBody = { status: 404, error: 'NOT_FOUND', message: 'The requested theme was not found.' }

// Vrai service, vrai repository SQLite : seule l'authentification, la validation d'UUID et le rate limit sont neutralisés.
const assembledServerWithRealThemeService = (database: Database): QuizServer => {
	const themeRouteConfiguration: ThemeRouteConfiguration = {
		themeService: new DefaultThemeService(mockClock, { generate: vi.fn() }, new SqliteThemeRepository(database)),
		uuidValidator: { validate: () => true },
		tokenValidator: mockTokenValidator,
		tokenDecoder: mockTokenDecoder,
		middleware: mockMiddleware,
		rateLimitMiddleware: mockRateLimitMiddleware
	}
	return new QuizServer(mockQuizServerConfiguration, mockTokenRouteConfiguration, themeRouteConfiguration, mockWsRouteConfiguration, mockQuestionRouteConfiguration)
}

describe('US-004/CA-25 - An unknown theme answers 404 on PUT on the assembled server', () => {
	let database: Database
	let server: QuizServer
	beforeEach(() => {
		database = new SqliteDatabase(':memory:')
		server = assembledServerWithRealThemeService(database)
	})
	it('answers 404 NOT_FOUND with the standard body', async () => {
		await server.start()
		const response = await server.inject({
			method: 'PUT',
			url: `/api/v1/themes/${unknownThemeId}`,
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name: 'Inexistant' })
		})
		expect(response.statusCode).toBe(404)
		expect(response.json()).toEqual(unknownThemeBody)
	})
	afterEach(async () => {
		await server.stop()
		database.close()
	});
});

describe('US-004/CA-29 - An unknown theme answers 404 on DELETE on the assembled server', () => {
	let database: Database
	let server: QuizServer
	beforeEach(() => {
		database = new SqliteDatabase(':memory:')
		server = assembledServerWithRealThemeService(database)
	})
	it('answers 404 NOT_FOUND with the standard body', async () => {
		await server.start()
		const response = await server.inject({ method: 'DELETE', url: `/api/v1/themes/${unknownThemeId}` })
		expect(response.statusCode).toBe(404)
		expect(response.json()).toEqual(unknownThemeBody)
	})
	afterEach(async () => {
		await server.stop()
		database.close()
	});
});

const unknownRouteBody = { status: 404, error: 'NOT_FOUND', message: 'The requested resource was not found.' }

describe('CA-UnknownRoute (decision #35) - An unknown route answers 404 NOT_FOUND on the assembled server', () => {
	let server: QuizServer
	beforeEach(() => {
		server = new QuizServer(mockQuizServerConfiguration, mockTokenRouteConfiguration, mockThemeRouteConfiguration, mockWsRouteConfiguration, mockQuestionRouteConfiguration)
	})
	it('answers 404 NOT_FOUND with the standard body, without a token', async () => {
		await server.start()
		const response = await server.inject({ method: 'GET', url: '/api/v1/does-not-exist' })
		expect(response.statusCode).toBe(404)
		expect(response.json()).toEqual(unknownRouteBody)
	})
	afterEach(async () => {
		await server.stop()
	})
});

describe('CA-UnknownRoute (decision #35) - An unknown route is answered before authentication and role on the assembled server', () => {
	let server: QuizServer
	let tokenValidator: TokenValidator
	let tokenDecoder: TokenDecoder
	beforeEach(() => {
		tokenValidator = { validateToken: vi.fn((token: string) => token !== 'invalid'), inspectToken: vi.fn() }
		tokenDecoder = { decode: vi.fn((token: string) => ({ role: token === 'admin' ? UserRole.ADMIN : UserRole.PLAYER })) }
		const protectedThemeConfiguration: ThemeRouteConfiguration = { ...mockThemeRouteConfiguration, tokenValidator, tokenDecoder, middleware: authenticationMiddleware }
		const protectedQuestionConfiguration: QuestionRouteConfiguration = { ...mockQuestionRouteConfiguration, tokenValidator, tokenDecoder, middleware: authenticationMiddleware }
		server = new QuizServer(mockQuizServerConfiguration, mockTokenRouteConfiguration, protectedThemeConfiguration, mockWsRouteConfiguration, protectedQuestionConfiguration)
	})
	it('keeps the authentication live on a known route (control)', async () => {
		await server.start()
		const response = await server.inject({ method: 'GET', url: '/api/v1/themes' })
		expect(response.statusCode).toBe(401)
	})
	it.each([
		['without a token', 'GET', undefined],
		['with an invalid token', 'GET', 'Bearer invalid'],
		['with a buzzer token and a write method', 'POST', 'Bearer buzzer'],
		['with an admin token', 'GET', 'Bearer admin'],
		['with an unsupported method', 'PATCH', undefined]
	])('answers 404 NOT_FOUND %s', async (_label, method, authorization) => {
		await server.start()
		const response = await server.inject({ method: method as 'GET' | 'POST' | 'PATCH', url: '/api/v1/does-not-exist', headers: authorization ? { authorization } : {} })
		expect(response.statusCode).toBe(404)
		expect(response.json()).toEqual(unknownRouteBody)
	})
	it('does not repeat the method or the url of the request in the message', async () => {
		await server.start()
		const response = await server.inject({ method: 'GET', url: '/api/v1/does-not-exist?x=<script>' })
		const { message } = response.json<{ message: string }>()
		expect(message).not.toContain('does-not-exist')
		expect(message).not.toContain('GET')
	})
	afterEach(async () => {
		await server.stop()
	})
});

describe('CA-UnknownRoute (decision #35) - An unknown route is rate limited on the assembled server', () => {
	let server: QuizServer
	beforeEach(() => {
		const limitedConfiguration: QuizServerConfiguration = {
			...mockQuizServerConfiguration,
			rateLimitMiddleware: async (app) => { await rateLimitMiddleware(app, { maxRequestsPerMinute: 2 }) }
		}
		server = new QuizServer(limitedConfiguration, mockTokenRouteConfiguration, mockThemeRouteConfiguration, mockWsRouteConfiguration, mockQuestionRouteConfiguration)
	})
	it('answers 429 RATE_LIMIT_EXCEEDED once the limit is passed, with Retry-After and the standard body', async () => {
		await server.start()
		const first = await server.inject({ method: 'GET', url: '/api/v1/does-not-exist' })
		const second = await server.inject({ method: 'GET', url: '/api/v1/does-not-exist' })
		const third = await server.inject({ method: 'GET', url: '/api/v1/does-not-exist' })
		expect([first.statusCode, second.statusCode]).toEqual([404, 404])
		expect(third.statusCode).toBe(429)
		expect(third.headers['retry-after']).toBe('60')
		expect(third.json()).toEqual({ status: 429, error: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please retry in 60 seconds.' })
	})
	afterEach(async () => {
		await server.stop()
	})
});
