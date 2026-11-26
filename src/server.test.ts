import { createServer } from 'node:net'
import { networkInterfaces, type NetworkInterfaceInfo } from 'node:os'
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

const mockQuizServerConfiguration: QuizServerConfiguration = {
	clock: mockClock,
	network: mockNetwork,
	port: 0, // le système choisit un port libre à chaque start() : un port fixe (3000) entre en collision avec les autres fichiers de la suite, lancés en parallèle (le hub de index.test.ts écoute sur 3000)
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

const mockTokenRouteConfiguration: TokenRouteConfiguration = {
	authenticationService: mockAuthenticationService,
	tokenGenerator: mockTokenGenerator
};

const mockThemeRouteConfiguration: ThemeRouteConfiguration = {
	themeService: mockThemeService,
	uuidValidator: mockUuidValidator,
	tokenValidator: mockTokenValidator,
	tokenDecoder: mockTokenDecoder,
	middleware: mockMiddleware
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
	middleware: mockMiddleware
}

async function reserveFreePort(): Promise<number> {
	const reservation = createServer()
	await new Promise<void>((resolve) => reservation.listen(0, '127.0.0.1', resolve))
	const { port } = reservation.address() as { port: number }
	await new Promise<void>((resolve) => reservation.close(() => resolve()))
	return port
}

// Pour les tests qui lisent le numéro de port dans un message (3000, le port par défaut du hub) : ils n'ont pas besoin d'un vrai socket,
// et ouvrir le 3000 pour un message ferait dépendre le test de la disponibilité de ce port.
function withoutListening(server: QuizServer): QuizServer {
	vi.spyOn(server['app'], 'listen').mockResolvedValue(undefined)
	return server
}

const firstExternalIPv4Address = Object.values(networkInterfaces()).flat()
	.find(iface => iface?.family === 'IPv4' && !iface.internal)?.address

describe('CA-1 - Le serveur démarre sans erreur', () => {
	let server: QuizServer
	let configuredPort: number
	beforeEach(async () => {
		configuredPort = await reserveFreePort()
		server = new QuizServer({ ...mockQuizServerConfiguration, port: configuredPort }, mockTokenRouteConfiguration, mockThemeRouteConfiguration, mockWsRouteConfiguration, mockQuestionRouteConfiguration);
	})
	it('should start and answer a real request on the configured port', async () => {
		await server.start()
		const response = await fetch(`http://127.0.0.1:${configuredPort}/health`)
		expect(response.status).toBe(200)
	})
	it.skipIf(firstExternalIPv4Address === undefined)('should answer on the network address of the machine, not only on loopback', async () => {
		await server.start()
		const response = await fetch(`http://${firstExternalIPv4Address}:${configuredPort}/health`)
		expect(response.status).toBe(200)
	})
	afterEach(async () => {
		await server.stop()
	})
})

function anInterface(address: string, family: 'IPv4' | 'IPv6', internal: boolean): NetworkInterfaceInfo {
	return family === 'IPv4'
		? { address, netmask: '255.255.255.0', family, mac: '00:00:00:00:00:00', internal, cidr: `${address}/24` }
		: { address, netmask: 'ffff:ffff:ffff:ffff::', family, mac: '00:00:00:00:00:00', internal, cidr: `${address}/64`, scopeid: 0 }
}

function aNetworkWith(interfaces: NodeJS.Dict<NetworkInterfaceInfo[]>): Network {
	return { networkInterfaces: () => interfaces }
}

describe('CA-2 - La console affiche l`heure de lancement', () => {
	let server: QuizServer
	let spy: MockInstance<typeof console.log>
	function aServerStartedAt(time: string): QuizServer {
		return new QuizServer({ ...mockQuizServerConfiguration, clock: { now: () => new Date(`2026-04-02T${time}`) } }, mockTokenRouteConfiguration, mockThemeRouteConfiguration, mockWsRouteConfiguration, mockQuestionRouteConfiguration)
	}
	beforeEach(() => {
		spy = vi.spyOn(console, 'log')
		spy.mockClear() // les appels des autres blocs ne doivent pas valider ces assertions
		server = new QuizServer(mockQuizServerConfiguration, mockTokenRouteConfiguration, mockThemeRouteConfiguration, mockWsRouteConfiguration, mockQuestionRouteConfiguration);
	})
	it('should display a message with current hour within console', async () => {
		await server.start()
		expect(spy).toHaveBeenCalledWith('🚀 Server started at 14:32:07')
	})
	it('should pad the hours, the minutes and the seconds with a leading zero', async () => {
		await server.stop()
		server = aServerStartedAt('03:04:05')
		await server.start()
		expect(spy).toHaveBeenCalledWith('🚀 Server started at 03:04:05')
	})
	afterEach(async () => {
		await server.stop()
		spy.mockRestore()
	})
})

describe('CA-3 - La console affiche l`adresse IP et le port', () => {
	let server: QuizServer
	let spy: MockInstance<typeof console.log>
	function aServerOn(network: Network, port: number): QuizServer {
		return new QuizServer({ ...mockQuizServerConfiguration, network, port }, mockTokenRouteConfiguration, mockThemeRouteConfiguration, mockWsRouteConfiguration, mockQuestionRouteConfiguration)
	}
	beforeEach(() => {
		spy = vi.spyOn(console, 'log')
		spy.mockClear() // les appels des autres blocs ne doivent pas valider ces assertions
		server = new QuizServer(mockQuizServerConfiguration, mockTokenRouteConfiguration, mockThemeRouteConfiguration, mockWsRouteConfiguration, mockQuestionRouteConfiguration);
	})
	it('should display the IP address and the port within console', async () => {
		await server.stop()
		server = withoutListening(aServerOn(mockNetwork, 3000))
		await server.start()
		expect(spy).toHaveBeenCalledWith('📡 Listening on http://192.168.1.42:3000')
	})
	it('should display the first non loopback IPv4 address when several interfaces are found', async () => {
		await server.stop()
		server = withoutListening(aServerOn(aNetworkWith({
			'lo': [anInterface('127.0.0.1', 'IPv4', true)],
			'eth0': [anInterface('fe80::1', 'IPv6', false), anInterface('192.168.1.42', 'IPv4', false)],
			'wlan0': [anInterface('10.0.0.7', 'IPv4', false)]
		}), 3000))
		await server.start()
		expect(spy).toHaveBeenCalledWith('📡 Listening on http://192.168.1.42:3000')
	})
	it('should display the configured port', async () => {
		await server.stop()
		const configuredPort = await reserveFreePort()
		server = aServerOn(mockNetwork, configuredPort)
		await server.start()
		expect(spy).toHaveBeenCalledWith(`📡 Listening on http://192.168.1.42:${configuredPort}`)
	})
	afterEach(async () => {
		await server.stop()
		spy.mockRestore()
	})
})

describe('CA-4 - Message de fallback si pas d`adresse IP trouvée', () => {
	let server: QuizServer
	let spy: MockInstance<typeof console.log>
	function aServerOn(network: Network, port: number): QuizServer {
		return new QuizServer({ ...mockQuizServerConfiguration, network, port }, mockTokenRouteConfiguration, mockThemeRouteConfiguration, mockWsRouteConfiguration, mockQuestionRouteConfiguration)
	}
	beforeEach(() => {
		spy = vi.spyOn(console, 'log')
		spy.mockClear() // les appels des autres blocs ne doivent pas valider ces assertions
		server = withoutListening(aServerOn(aNetworkWith({}), 3000))
	})
	it('should display a fallback message if no IP address is found', async () => {
		await server.start()
		expect(spy).toHaveBeenCalledWith('⚠️ No network interface found, listening on http://localhost:3000')
	})
	it('should display the fallback message if only loopback and IPv6 interfaces are found', async () => {
		await server.stop()
		server = withoutListening(aServerOn(aNetworkWith({
			'lo': [anInterface('127.0.0.1', 'IPv4', true)],
			'eth0': [anInterface('fe80::1', 'IPv6', false)]
		}), 3000))
		await server.start()
		expect(spy).toHaveBeenCalledWith('⚠️ No network interface found, listening on http://localhost:3000')
	})
	it('should display the configured port within the fallback message', async () => {
		await server.stop()
		const configuredPort = await reserveFreePort()
		server = aServerOn(aNetworkWith({}), configuredPort)
		await server.start()
		expect(spy).toHaveBeenCalledWith(`⚠️ No network interface found, listening on http://localhost:${configuredPort}`)
	})
	afterEach(async () => {
		await server.stop()
		spy.mockRestore()
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
			middleware: mockMiddleware // no-op : l'authentification n'est pas l'objet de ce test
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
			middleware: mockMiddleware // no-op : l'authentification n'est pas l'objet de ce test
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
			middleware: mockMiddleware // no-op : l'authentification n'est pas l'objet de ce test
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
			middleware: mockMiddleware // no-op : l'authentification n'est pas l'objet de ce test
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
			middleware: mockMiddleware // no-op : l'authentification n'est pas l'objet de ce test
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
			middleware: mockMiddleware // no-op : l'authentification n'est pas l'objet de ce test
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
const writtenQuestionId = '019d92d2-e1f6-7d05-9803-3948dbc4c416'
const existingThemeId = '019da051-e379-74e7-b446-65518f88cc3a'
const unknownThemeBody = { status: 404, error: 'NOT_FOUND', message: 'The requested theme was not found.' }

// Vrai service, vrai repository SQLite, vrai UuidFormatValidator (celui que index.ts donne à la route des thèmes) : seuls l'authentification et le rate limit sont neutralisés.
const assembledServerWithRealThemeService = (database: Database): QuizServer => {
	const themeRouteConfiguration: ThemeRouteConfiguration = {
		themeService: new DefaultThemeService(mockClock, { generate: vi.fn() }, new SqliteThemeRepository(database)),
		uuidValidator: new UuidFormatValidator(),
		tokenValidator: mockTokenValidator,
		tokenDecoder: mockTokenDecoder,
		middleware: mockMiddleware
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

describe('US-004/CA-21, CA-23, CA-25a and CA-27 - A PUT with a malformed id or a missing or mistyped name is refused on the assembled server (decisions #99 and #100)', () => {
	let database: Database
	let server: QuizServer
	beforeEach(() => {
		database = new SqliteDatabase(':memory:')
		server = assembledServerWithRealThemeService(database)
	})
	const put = (url: string, payload: string) => server.inject({ method: 'PUT', url, headers: { 'content-type': 'application/json' }, payload })
	const formMessage = 'Theme name must be 3 to 40 characters, start with an uppercase letter, end with a letter or digit, and contain only letters, digits, spaces, apostrophes and hyphens.'
	it('answers 400 INVALID_UUID to a malformed id in the path', async () => {
		await server.start()
		const response = await put('/api/v1/themes/not-a-uuid', JSON.stringify({ name: 'Musique' }))
		expect(response.statusCode).toBe(400)
		expect(response.json()).toEqual({ status: 400, error: 'INVALID_UUID', message: 'The provided ID is not a valid UUID.' })
	})
	it.each([
		['{}', 'Theme name is required.'],
		['{"name":null}', 'Theme name is required.'],
		['{"name":42}', 'Theme name must be a string.'],
		['{"name":["Musique"]}', 'Theme name must be a string.']
	])('answers 400 VALIDATION_ERROR to %s on an unknown id, not 404 nor 500', async (payload, message) => {
		await server.start()
		const response = await put(`/api/v1/themes/${unknownThemeId}`, payload)
		expect(response.statusCode).toBe(400)
		expect(response.json()).toEqual({ status: 400, error: 'VALIDATION_ERROR', message })
	})
	it('answers 400 INVALID_BODY to a body that is not an object', async () => {
		await server.start()
		const response = await put(`/api/v1/themes/${unknownThemeId}`, '[]')
		expect(response.statusCode).toBe(400)
		expect(response.json()).toEqual({ status: 400, error: 'INVALID_BODY', message: 'Request body must be a JSON object.' })
	})
	it('answers 400 VALIDATION_ERROR to a malformed name on an unknown id, before the 404', async () => {
		await server.start()
		const response = await put(`/api/v1/themes/${unknownThemeId}`, JSON.stringify({ name: 'm' }))
		expect(response.statusCode).toBe(400)
		expect(response.json()).toEqual({ status: 400, error: 'VALIDATION_ERROR', message: formMessage })
	})
	it('answers 400 UNKNOWN_FIELDS to an unknown field next to a well typed name on an existing theme', async () => {
		await server.start()
		new SqliteThemeRepository(database).insert({ id: existingThemeId, name: 'Musique', created_at: '2026-04-08T13:32:00.000Z', last_updated_at: null })
		const response = await put(`/api/v1/themes/${existingThemeId}`, JSON.stringify({ name: 'Sport', couleur: 'rouge' }))
		expect(response.statusCode).toBe(400)
		expect(response.json()).toEqual({ status: 400, error: 'UNKNOWN_FIELDS', message: 'Unknown field(s): couleur.' })
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

describe('US-004/CA-8 and CA-26 - A theme write without content-type is refused with 415 after the rate limit, the authentication and the role, on the assembled server (decisions #82, #96 and #101)', () => {
	const rateLimitedBody = { status: 429, error: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please retry in 60 seconds.' }
	const unsupportedMediaType = { code: 'FST_ERR_CTP_INVALID_MEDIA_TYPE', error: 'Unsupported Media Type', message: 'Unsupported Media Type', statusCode: 415 }
	let server: QuizServer
	beforeEach(() => {
		const tokenValidator: TokenValidator = { validateToken: vi.fn((token: string) => token !== 'invalid'), inspectToken: vi.fn() }
		const tokenDecoder: TokenDecoder = { decode: vi.fn((token: string) => ({ role: token === 'admin' ? UserRole.ADMIN : UserRole.PLAYER })) }
		const protectedThemeConfiguration: ThemeRouteConfiguration = { ...mockThemeRouteConfiguration, tokenValidator, tokenDecoder, middleware: authenticationMiddleware }
		const limitedConfiguration: QuizServerConfiguration = {
			...mockQuizServerConfiguration,
			rateLimitMiddleware: async (app) => { await rateLimitMiddleware(app, { maxRequestsPerMinute: 3 }) }
		}
		server = new QuizServer(limitedConfiguration, mockTokenRouteConfiguration, protectedThemeConfiguration, mockWsRouteConfiguration, mockQuestionRouteConfiguration)
	})
	afterEach(async () => {
		await server.stop()
	})
	const writes = [
		['POST', '/api/v1/themes'],
		['PUT', `/api/v1/themes/${unknownThemeId}`]
	] as const
	const write = (method: 'POST' | 'PUT', url: string, authorization?: string, remoteAddress?: string) => server.inject({ method, url, remoteAddress, headers: authorization ? { authorization } : {} })
	it.each(writes)('answers the native 415 to an admin %s %s without content-type and without body', async (method, url) => {
		await server.start()
		const response = await write(method, url, 'Bearer admin')
		expect(response.statusCode).toBe(415)
		expect(response.json()).toEqual(unsupportedMediaType)
	})
	it.each(writes)('keeps the 401 of a %s %s without token, before the 415', async (method, url) => {
		await server.start()
		const response = await write(method, url)
		expect(response.statusCode).toBe(401)
		expect(response.json()).toEqual({ status: 401, error: 'UNAUTHORIZED', message: 'Authentication token is missing or invalid.' })
	})
	it.each(writes)('keeps the 403 of a %s %s from a player, before the 415', async (method, url) => {
		await server.start()
		const response = await write(method, url, 'Bearer player')
		expect(response.statusCode).toBe(403)
		expect(response.json()).toEqual({ status: 403, error: 'FORBIDDEN', message: 'You do not have permission to perform this action.' })
	})
	it.each(writes)('counts the 415 of a %s %s and answers the fourth request with 429 instead', async (method, url) => {
		await server.start()
		const answered = [await write(method, url, 'Bearer admin'), await write(method, url, 'Bearer admin'), await write(method, url, 'Bearer admin')]
		expect(answered.map(response => response.statusCode)).toEqual([415, 415, 415])
		const refused = await write(method, url, 'Bearer admin')
		expect(refused.statusCode).toBe(429)
		expect(refused.json()).toEqual(rateLimitedBody)
	})
});

describe('US-004/CA-8 and CA-26 - A theme write with a charset other than utf-8 is refused with 415 after the rate limit, the authentication and the role, on the assembled server (decisions #89, #96 and #101)', () => {
	const rateLimitedBody = { status: 429, error: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please retry in 60 seconds.' }
	const unsupportedMediaType = { code: 'FST_ERR_CTP_INVALID_MEDIA_TYPE', error: 'Unsupported Media Type', message: 'Unsupported Media Type', statusCode: 415 }
	const latin1 = 'application/json; charset=latin1'
	let server: QuizServer
	beforeEach(() => {
		const tokenValidator: TokenValidator = { validateToken: vi.fn((token: string) => token !== 'invalid'), inspectToken: vi.fn() }
		const tokenDecoder: TokenDecoder = { decode: vi.fn((token: string) => ({ role: token === 'admin' ? UserRole.ADMIN : UserRole.PLAYER })) }
		const protectedThemeConfiguration: ThemeRouteConfiguration = { ...mockThemeRouteConfiguration, tokenValidator, tokenDecoder, middleware: authenticationMiddleware }
		const limitedConfiguration: QuizServerConfiguration = {
			...mockQuizServerConfiguration,
			rateLimitMiddleware: async (app) => { await rateLimitMiddleware(app, { maxRequestsPerMinute: 3 }) }
		}
		server = new QuizServer(limitedConfiguration, mockTokenRouteConfiguration, protectedThemeConfiguration, mockWsRouteConfiguration, mockQuestionRouteConfiguration)
	})
	afterEach(async () => {
		await server.stop()
	})
	const writes = [
		['POST', '/api/v1/themes'],
		['PUT', `/api/v1/themes/${unknownThemeId}`]
	] as const
	const write = (method: 'POST' | 'PUT', url: string, authorization?: string) => server.inject({
		method,
		url,
		headers: authorization ? { authorization, 'content-type': latin1 } : { 'content-type': latin1 },
		payload: JSON.stringify({ name: 'Musique' })
	})
	it.each(writes)('answers the native 415 to an admin %s %s with charset=latin1', async (method, url) => {
		await server.start()
		const response = await write(method, url, 'Bearer admin')
		expect(response.statusCode).toBe(415)
		expect(response.json()).toEqual(unsupportedMediaType)
	})
	it.each(writes)('keeps the 401 of a %s %s without token, before the 415', async (method, url) => {
		await server.start()
		const response = await write(method, url)
		expect(response.statusCode).toBe(401)
	})
	it.each(writes)('keeps the 403 of a %s %s from a player, before the 415', async (method, url) => {
		await server.start()
		const response = await write(method, url, 'Bearer player')
		expect(response.statusCode).toBe(403)
	})
	it.each(writes)('counts the 415 of a %s %s and answers the fourth request with 429 instead', async (method, url) => {
		await server.start()
		const answered = [await write(method, url, 'Bearer admin'), await write(method, url, 'Bearer admin'), await write(method, url, 'Bearer admin')]
		expect(answered.map(response => response.statusCode)).toEqual([415, 415, 415])
		const refused = await write(method, url, 'Bearer admin')
		expect(refused.statusCode).toBe(429)
		expect(refused.json()).toEqual(rateLimitedBody)
	})
});

describe('US-005/CA-20 and CA-41 - A question write without content-type is refused with 415 after the rate limit, the authentication and the role, on the assembled server (decisions #82, #96 and #102)', () => {
	const rateLimitedBody = { status: 429, error: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please retry in 60 seconds.' }
	const unsupportedMediaType = { code: 'FST_ERR_CTP_INVALID_MEDIA_TYPE', error: 'Unsupported Media Type', message: 'Unsupported Media Type', statusCode: 415 }
	let server: QuizServer
	beforeEach(() => {
		const tokenValidator: TokenValidator = { validateToken: vi.fn((token: string) => token !== 'invalid'), inspectToken: vi.fn() }
		const tokenDecoder: TokenDecoder = { decode: vi.fn((token: string) => ({ role: token === 'admin' ? UserRole.ADMIN : UserRole.PLAYER })) }
		const protectedQuestionConfiguration: QuestionRouteConfiguration = { ...mockQuestionRouteConfiguration, tokenValidator, tokenDecoder, middleware: authenticationMiddleware }
		const limitedConfiguration: QuizServerConfiguration = {
			...mockQuizServerConfiguration,
			rateLimitMiddleware: async (app) => { await rateLimitMiddleware(app, { maxRequestsPerMinute: 3 }) }
		}
		server = new QuizServer(limitedConfiguration, mockTokenRouteConfiguration, mockThemeRouteConfiguration, mockWsRouteConfiguration, protectedQuestionConfiguration)
	})
	afterEach(async () => {
		await server.stop()
	})
	const writes = [
		['POST', '/api/v1/questions'],
		['PUT', `/api/v1/questions/${writtenQuestionId}`]
	] as const
	const write = (method: 'POST' | 'PUT', url: string, authorization?: string) => server.inject({ method, url, headers: authorization ? { authorization } : {} })
	it.each(writes)('answers the native 415 to an admin %s %s without content-type and without body', async (method, url) => {
		await server.start()
		const response = await write(method, url, 'Bearer admin')
		expect(response.statusCode).toBe(415)
		expect(response.json()).toEqual(unsupportedMediaType)
	})
	it.each(writes)('keeps the 401 of a %s %s without token, before the 415', async (method, url) => {
		await server.start()
		const response = await write(method, url)
		expect(response.statusCode).toBe(401)
		expect(response.json()).toEqual({ status: 401, error: 'UNAUTHORIZED', message: 'Authentication token is missing or invalid.' })
	})
	it.each(writes)('keeps the 403 of a %s %s from a player, before the 415', async (method, url) => {
		await server.start()
		const response = await write(method, url, 'Bearer player')
		expect(response.statusCode).toBe(403)
		expect(response.json()).toEqual({ status: 403, error: 'FORBIDDEN', message: 'You do not have permission to perform this action.' })
	})
	it.each(writes)('counts the 415 of a %s %s and answers the fourth request with 429 instead', async (method, url) => {
		await server.start()
		const answered = [await write(method, url, 'Bearer admin'), await write(method, url, 'Bearer admin'), await write(method, url, 'Bearer admin')]
		expect(answered.map(response => response.statusCode)).toEqual([415, 415, 415])
		const refused = await write(method, url, 'Bearer admin')
		expect(refused.statusCode).toBe(429)
		expect(refused.json()).toEqual(rateLimitedBody)
	})
});

describe('US-005/CA-20 and CA-41 - A question write with a charset other than utf-8 is refused with 415 after the rate limit, the authentication and the role, on the assembled server (decisions #89, #96 and #102)', () => {
	const rateLimitedBody = { status: 429, error: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please retry in 60 seconds.' }
	const unsupportedMediaType = { code: 'FST_ERR_CTP_INVALID_MEDIA_TYPE', error: 'Unsupported Media Type', message: 'Unsupported Media Type', statusCode: 415 }
	const latin1 = 'application/json; charset=latin1'
	let server: QuizServer
	beforeEach(() => {
		const tokenValidator: TokenValidator = { validateToken: vi.fn((token: string) => token !== 'invalid'), inspectToken: vi.fn() }
		const tokenDecoder: TokenDecoder = { decode: vi.fn((token: string) => ({ role: token === 'admin' ? UserRole.ADMIN : UserRole.PLAYER })) }
		const protectedQuestionConfiguration: QuestionRouteConfiguration = { ...mockQuestionRouteConfiguration, tokenValidator, tokenDecoder, middleware: authenticationMiddleware }
		const limitedConfiguration: QuizServerConfiguration = {
			...mockQuizServerConfiguration,
			rateLimitMiddleware: async (app) => { await rateLimitMiddleware(app, { maxRequestsPerMinute: 3 }) }
		}
		server = new QuizServer(limitedConfiguration, mockTokenRouteConfiguration, mockThemeRouteConfiguration, mockWsRouteConfiguration, protectedQuestionConfiguration)
	})
	afterEach(async () => {
		await server.stop()
	})
	const writes = [
		['POST', '/api/v1/questions'],
		['PUT', `/api/v1/questions/${writtenQuestionId}`]
	] as const
	const write = (method: 'POST' | 'PUT', url: string, authorization?: string) => server.inject({
		method,
		url,
		headers: authorization ? { authorization, 'content-type': latin1 } : { 'content-type': latin1 },
		payload: '{}'
	})
	it.each(writes)('answers the native 415 to an admin %s %s with charset=latin1', async (method, url) => {
		await server.start()
		const response = await write(method, url, 'Bearer admin')
		expect(response.statusCode).toBe(415)
		expect(response.json()).toEqual(unsupportedMediaType)
	})
	it.each(writes)('keeps the 401 of a %s %s without token, before the 415', async (method, url) => {
		await server.start()
		const response = await write(method, url)
		expect(response.statusCode).toBe(401)
	})
	it.each(writes)('keeps the 403 of a %s %s from a player, before the 415', async (method, url) => {
		await server.start()
		const response = await write(method, url, 'Bearer player')
		expect(response.statusCode).toBe(403)
	})
	it.each(writes)('counts the 415 of a %s %s and answers the fourth request with 429 instead', async (method, url) => {
		await server.start()
		const answered = [await write(method, url, 'Bearer admin'), await write(method, url, 'Bearer admin'), await write(method, url, 'Bearer admin')]
		expect(answered.map(response => response.statusCode)).toEqual([415, 415, 415])
		const refused = await write(method, url, 'Bearer admin')
		expect(refused.statusCode).toBe(429)
		expect(refused.json()).toEqual(rateLimitedBody)
	})
});

describe('US-003/CA-13 - CA-RateLimit (decision #96) - One counter per address is shared by the whole API on the assembled server', () => {
	const rateLimitedBody = { status: 429, error: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please retry in 60 seconds.' }
	let server: QuizServer
	beforeEach(() => {
		const tokenValidator: TokenValidator = { validateToken: vi.fn((token: string) => token !== 'invalid'), inspectToken: vi.fn() }
		const tokenDecoder: TokenDecoder = { decode: vi.fn((token: string) => ({ role: token === 'admin' ? UserRole.ADMIN : UserRole.PLAYER })) }
		const protectedThemeConfiguration: ThemeRouteConfiguration = { ...mockThemeRouteConfiguration, tokenValidator, tokenDecoder, middleware: authenticationMiddleware }
		const protectedQuestionConfiguration: QuestionRouteConfiguration = { ...mockQuestionRouteConfiguration, tokenValidator, tokenDecoder, middleware: authenticationMiddleware }
		const limitedConfiguration: QuizServerConfiguration = {
			...mockQuizServerConfiguration,
			rateLimitMiddleware: async (app) => { await rateLimitMiddleware(app, { maxRequestsPerMinute: 3 }) }
		}
		server = new QuizServer(limitedConfiguration, mockTokenRouteConfiguration, protectedThemeConfiguration, mockWsRouteConfiguration, protectedQuestionConfiguration)
	})
	afterEach(async () => {
		await server.stop()
	})
	const postToken = (remoteAddress?: string) => server.inject({ method: 'POST', url: '/api/v1/token', remoteAddress, payload: { username: 'user', password: 'secret' } })
	const getThemes = (remoteAddress?: string) => server.inject({ method: 'GET', url: '/api/v1/themes', remoteAddress, headers: { authorization: 'Bearer admin' } })
	const getUnknown = (remoteAddress?: string) => server.inject({ method: 'GET', url: '/api/v1/does-not-exist', remoteAddress })
	const expectRefused = (response: { statusCode: number, headers: Record<string, unknown>, json: () => unknown }) => {
		expect(response.statusCode).toBe(429)
		expect(response.headers['retry-after']).toBe('60')
		expect(response.json()).toEqual(rateLimitedBody)
	}
	it.each([
		['a token request', postToken],
		['a themes request', getThemes],
		['a request to an unknown route', getUnknown]
	])('refuses %s once one request of each family has been counted', async (_family, fourthRequest) => {
		await server.start()
		const first = await postToken()
		const second = await getThemes()
		const third = await getUnknown()
		expect([first.statusCode, second.statusCode, third.statusCode]).toEqual([200, 200, 404])
		expectRefused(await fourthRequest())
	})
	it.each([
		['401', () => server.inject({ method: 'GET', url: '/api/v1/themes' })],
		['400', () => server.inject({ method: 'GET', url: '/api/v1/themes/not-a-uuid', headers: { authorization: 'Bearer admin' } })],
		['403', () => server.inject({ method: 'GET', url: '/api/v1/themes', headers: { authorization: 'Bearer buzzer' } })],
		['404', getUnknown]
	])('counts every %s and answers the fourth request with 429 instead', async (status, send) => {
		await server.start()
		const answered = [await send(), await send(), await send()]
		expect(answered.map(response => response.statusCode)).toEqual([Number(status), Number(status), Number(status)])
		expectRefused(await send())
	})
	it('counts three 405 of GET on the token route and refuses the following POST', async () => {
		await server.start()
		const methodNotAllowed = () => server.inject({ method: 'GET', url: '/api/v1/token' })
		const answered = [await methodNotAllowed(), await methodNotAllowed(), await methodNotAllowed()]
		expect(answered.map(response => response.statusCode)).toEqual([405, 405, 405])
		expectRefused(await postToken())
	})
	it('keeps a separate counter for another address', async () => {
		await server.start()
		await postToken('10.0.0.1')
		await getThemes('10.0.0.1')
		await getUnknown('10.0.0.1')
		expectRefused(await getThemes('10.0.0.1'))
		const otherAddress = [await postToken('10.0.0.2'), await getThemes('10.0.0.2'), await getUnknown('10.0.0.2')]
		expect(otherAddress.map(response => response.statusCode)).toEqual([200, 200, 404])
		expectRefused(await getUnknown('10.0.0.2'))
	})
	it.each([
		['a 405 on a known URL', () => server.inject({ method: 'GET', url: '/api/v1/token' })],
		['a 404 on an unknown URL', getUnknown],
		['a 401 on a protected URL', () => server.inject({ method: 'PATCH', url: '/api/v1/themes' })]
	])('uses a single unit of the limit for %s', async (_case, send) => {
		await server.start()
		const answered = [await send(), await send(), await send()]
		expect(answered.map(response => response.statusCode)).not.toContain(429)
		expectRefused(await send())
	})
	it('does not refuse /health once the limit is passed', async () => {
		await server.start()
		await getUnknown()
		await getUnknown()
		await getUnknown()
		expectRefused(await getUnknown())
		const health = await server.inject({ method: 'GET', url: '/health' })
		expect(health.statusCode).toBe(200)
		expect(health.json()).toEqual({ status: 'ok' })
	})
	it('does not count /health in the limit', async () => {
		await server.start()
		for (let attempt = 0; attempt < 5; attempt++) {
			expect((await server.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200)
		}
		const answered = [await getUnknown(), await getUnknown(), await getUnknown()]
		expect(answered.map(response => response.statusCode)).toEqual([404, 404, 404])
		expectRefused(await getUnknown())
	})
	it('does not refuse /ws once the limit is passed', async () => {
		await server.start()
		await getUnknown()
		await getUnknown()
		await getUnknown()
		expectRefused(await getUnknown())
		const withoutLimit = await server.inject({ method: 'GET', url: '/ws' })
		const withLimitOnly = await getUnknown()
		expect(withoutLimit.statusCode).not.toBe(429)
		expect(withLimitOnly.statusCode).toBe(429)
	})
	it('does not count /ws in the limit', async () => {
		await server.start()
		for (let attempt = 0; attempt < 5; attempt++) {
			expect((await server.inject({ method: 'GET', url: '/ws' })).statusCode).not.toBe(429)
		}
		const answered = [await getUnknown(), await getUnknown(), await getUnknown()]
		expect(answered.map(response => response.statusCode)).toEqual([404, 404, 404])
		expectRefused(await getUnknown())
	})
});

describe('US-003/CA-13 - CA-RateLimit (decision #97) - The counted address is the connection and the window is fixed on the assembled server', () => {
	const rateLimitedBody = { status: 429, error: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please retry in 60 seconds.' }
	const firstRequestAt = new Date('2026-04-02T14:32:07.000Z')
	let server: QuizServer
	beforeEach(() => {
		// Seule Date est simulée : le compteur de @fastify/rate-limit (LocalStore) lit Date.now() ; timers et I/O restent réels pour server.inject.
		vi.useFakeTimers({ toFake: ['Date'] })
		vi.setSystemTime(firstRequestAt)
		const limitedConfiguration: QuizServerConfiguration = {
			...mockQuizServerConfiguration,
			rateLimitMiddleware: async (app) => { await rateLimitMiddleware(app, { maxRequestsPerMinute: 3 }) }
		}
		server = new QuizServer(limitedConfiguration, mockTokenRouteConfiguration, mockThemeRouteConfiguration, mockWsRouteConfiguration, mockQuestionRouteConfiguration)
	})
	afterEach(async () => {
		await server.stop()
		vi.useRealTimers()
	})
	const getUnknown = (options: { remoteAddress?: string, forwardedFor?: string } = {}) => server.inject({
		method: 'GET',
		url: '/api/v1/does-not-exist',
		remoteAddress: options.remoteAddress,
		headers: options.forwardedFor === undefined ? {} : { 'x-forwarded-for': options.forwardedFor }
	})
	const expectRefused = (response: { statusCode: number, headers: Record<string, unknown>, json: () => unknown }) => {
		expect(response.statusCode).toBe(429)
		expect(response.headers['retry-after']).toBe('60')
		expect(response.json()).toEqual(rateLimitedBody)
	}
	const elapse = (seconds: number) => vi.setSystemTime(new Date(firstRequestAt.getTime() + seconds * 1000))
	const countThreeThenRefuse = async () => {
		const answered = [await getUnknown(), await getUnknown(), await getUnknown()]
		expect(answered.map(response => response.statusCode)).toEqual([404, 404, 404])
		expectRefused(await getUnknown())
	}
	it('counts the connection address when X-Forwarded-For changes on every request', async () => {
		await server.start()
		const answered = [
			await getUnknown({ forwardedFor: '203.0.113.1' }),
			await getUnknown({ forwardedFor: '203.0.113.2' }),
			await getUnknown({ forwardedFor: '203.0.113.3' })
		]
		expect(answered.map(response => response.statusCode)).toEqual([404, 404, 404])
		expectRefused(await getUnknown({ forwardedFor: '203.0.113.4' }))
	})
	it('does not share a counter between two connections that send the same X-Forwarded-For', async () => {
		await server.start()
		for (let attempt = 0; attempt < 3; attempt++) {
			expect((await getUnknown({ remoteAddress: '10.0.0.1', forwardedFor: '203.0.113.1' })).statusCode).toBe(404)
		}
		expectRefused(await getUnknown({ remoteAddress: '10.0.0.1', forwardedFor: '203.0.113.1' }))
		const otherConnection = await getUnknown({ remoteAddress: '10.0.0.2', forwardedFor: '203.0.113.1' })
		expect(otherConnection.statusCode).toBe(404)
	})
	it('reopens the window one minute after the first request and resets the counter', async () => {
		await server.start()
		await countThreeThenRefuse()
		elapse(60)
		await countThreeThenRefuse()
	})
	it('keeps the window closed until one minute after the first request, whatever the clock minute', async () => {
		await server.start()
		await countThreeThenRefuse()
		elapse(59)
		expectRefused(await getUnknown())
	})
	it('opens the window at the first request, not at the last counted one', async () => {
		await server.start()
		await getUnknown()
		elapse(30)
		await getUnknown()
		await getUnknown()
		expectRefused(await getUnknown())
		elapse(60)
		await countThreeThenRefuse()
	})
	it('does not extend the window when requests are refused', async () => {
		await server.start()
		await countThreeThenRefuse()
		for (const seconds of [20, 40, 59]) {
			elapse(seconds)
			expectRefused(await getUnknown())
		}
		elapse(60)
		await countThreeThenRefuse()
	})
});

describe('US-003/CA-13 - CA-RateLimit (decision #36) - A rate limited request answered later in the window still says Retry-After 60 on the assembled server', () => {
	const rateLimitedBody = { status: 429, error: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please retry in 60 seconds.' }
	const firstRequestAt = new Date('2026-04-02T14:32:07.000Z')
	let server: QuizServer
	beforeEach(() => {
		// Seule Date est simulée : le compteur de @fastify/rate-limit (LocalStore) lit Date.now() ; timers et I/O restent réels pour server.inject.
		vi.useFakeTimers({ toFake: ['Date'] })
		vi.setSystemTime(firstRequestAt)
		const tokenValidator: TokenValidator = { validateToken: vi.fn((token: string) => token !== 'invalid'), inspectToken: vi.fn() }
		const tokenDecoder: TokenDecoder = { decode: vi.fn((token: string) => ({ role: token === 'admin' ? UserRole.ADMIN : UserRole.PLAYER })) }
		const protectedThemeConfiguration: ThemeRouteConfiguration = { ...mockThemeRouteConfiguration, tokenValidator, tokenDecoder, middleware: authenticationMiddleware }
		const protectedQuestionConfiguration: QuestionRouteConfiguration = { ...mockQuestionRouteConfiguration, tokenValidator, tokenDecoder, middleware: authenticationMiddleware }
		const limitedConfiguration: QuizServerConfiguration = {
			...mockQuizServerConfiguration,
			rateLimitMiddleware: async (app) => { await rateLimitMiddleware(app, { maxRequestsPerMinute: 3 }) }
		}
		server = new QuizServer(limitedConfiguration, mockTokenRouteConfiguration, protectedThemeConfiguration, mockWsRouteConfiguration, protectedQuestionConfiguration)
	})
	afterEach(async () => {
		await server.stop()
		vi.useRealTimers()
	})
	const postToken = () => server.inject({ method: 'POST', url: '/api/v1/token', payload: { username: 'user', password: 'secret' } })
	const getThemes = () => server.inject({ method: 'GET', url: '/api/v1/themes', headers: { authorization: 'Bearer admin' } })
	const getQuestions = () => server.inject({ method: 'GET', url: '/api/v1/questions', headers: { authorization: 'Bearer admin' } })
	it.each([
		['POST /api/v1/token', postToken],
		['GET /api/v1/themes', getThemes],
		['GET /api/v1/questions', getQuestions]
	])('answers Retry-After 60, not the 57 seconds left, to a 429 obtained 3 seconds after the first request on %s', async (_route, send) => {
		await server.start()
		const answered = [await send(), await send(), await send()]
		expect(answered.map(response => response.statusCode)).toEqual([200, 200, 200])
		vi.setSystemTime(new Date(firstRequestAt.getTime() + 3000))
		const refused = await send()
		expect(refused.statusCode).toBe(429)
		expect(refused.headers['retry-after']).toBe('60')
		expect(refused.json()).toEqual(rateLimitedBody)
	})
});

describe('US-005/CA-53 - US-004/CA-35 - US-003/CA-16 (decisions #31 to #33) - An unsupported method on a protected route is answered after authentication and role on the assembled server', () => {
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
	it('answers 401 UNAUTHORIZED, without an Allow header, when the token is missing', async () => {
		await server.start()
		const response = await server.inject({ method: 'PATCH', url: '/api/v1/themes' })
		expect(response.statusCode).toBe(401)
		expect(response.headers['allow']).toBeUndefined()
		expect(response.json()).toEqual({ status: 401, error: 'UNAUTHORIZED', message: 'Authentication token is missing or invalid.' })
	})
	it('answers 403 FORBIDDEN, without an Allow header, to a buzzer token with a write method', async () => {
		await server.start()
		const response = await server.inject({ method: 'PATCH', url: '/api/v1/themes', headers: { authorization: 'Bearer buzzer' } })
		expect(response.statusCode).toBe(403)
		expect(response.headers['allow']).toBeUndefined()
		expect(response.json()).toEqual({ status: 403, error: 'FORBIDDEN', message: 'You do not have permission to perform this action.' })
	})
	it('answers 405 METHOD_NOT_ALLOWED with the Allow header and the standard body to an admin token', async () => {
		await server.start()
		const response = await server.inject({ method: 'PATCH', url: '/api/v1/themes', headers: { authorization: 'Bearer admin' } })
		expect(response.statusCode).toBe(405)
		expect(response.headers['allow']).toBe('GET, POST')
		expect(response.json()).toEqual({ status: 405, error: 'METHOD_NOT_ALLOWED', message: 'HTTP method PATCH is not allowed on this resource.' })
	})
	it('answers 405 to a buzzer token with a method that is not a write method', async () => {
		await server.start()
		const response = await server.inject({ method: 'OPTIONS', url: '/api/v1/themes', headers: { authorization: 'Bearer buzzer' } })
		expect(response.statusCode).toBe(405)
		expect(response.headers['allow']).toBe('GET, POST')
		expect(response.json()).toEqual({ status: 405, error: 'METHOD_NOT_ALLOWED', message: 'HTTP method OPTIONS is not allowed on this resource.' })
	})
	it('answers 405 to HEAD on a GET route, without HEAD in the Allow header', async () => {
		await server.start()
		const response = await server.inject({ method: 'HEAD', url: '/api/v1/themes', headers: { authorization: 'Bearer admin' } })
		expect(response.statusCode).toBe(405)
		expect(response.headers['allow']).toBe('GET, POST')
	})
	it('lists the methods of a resource with a path parameter', async () => {
		await server.start()
		const response = await server.inject({ method: 'POST', url: '/api/v1/questions/018e4f5a-0000-0000-0000-000000000000', headers: { authorization: 'Bearer admin' } })
		expect(response.statusCode).toBe(405)
		expect(response.headers['allow']).toBe('GET, PUT, DELETE')
	})
	it.each([
		['/health'],
		['/ws']
	])('keeps answering 404 NOT_FOUND to an unsupported method on %s, which is outside the API resources', async (url) => {
		await server.start()
		const response = await server.inject({ method: 'POST', url })
		expect(response.statusCode).toBe(404)
		expect(response.json()).toEqual(unknownRouteBody)
	})
	it.each([
		['PUT', '/api/v1/themes'],
		['PATCH', '/api/v1/themes'],
		['DELETE', '/api/v1/themes'],
		['POST', '/api/v1/themes/018e4f5a-0000-0000-0000-000000000000']
	])('answers 403 FORBIDDEN to a buzzer token with %s on %s', async (method, url) => {
		await server.start()
		const response = await server.inject({ method: method as 'PUT' | 'PATCH' | 'DELETE' | 'POST', url, headers: { authorization: 'Bearer buzzer' } })
		expect(response.statusCode).toBe(403)
	})
	it('answers 401 UNAUTHORIZED, without an Allow header, when the token is invalid', async () => {
		await server.start()
		const response = await server.inject({ method: 'PATCH', url: '/api/v1/themes', headers: { authorization: 'Bearer invalid' } })
		expect(response.statusCode).toBe(401)
		expect(response.headers['allow']).toBeUndefined()
		expect(response.json()).toEqual({ status: 401, error: 'UNAUTHORIZED', message: 'Authentication token is missing or invalid.' })
	})
	it('ignores the query string to find the resource', async () => {
		await server.start()
		const response = await server.inject({ method: 'PATCH', url: '/api/v1/themes?page=2', headers: { authorization: 'Bearer admin' } })
		expect(response.statusCode).toBe(405)
		expect(response.headers['allow']).toBe('GET, POST')
	})
	it('keeps the supported methods working (a GET is not answered with 405)', async () => {
		await server.start()
		const response = await server.inject({ method: 'GET', url: '/api/v1/themes', headers: { authorization: 'Bearer admin' } })
		expect(response.statusCode).not.toBe(405)
	})
	it('treats a path as a known resource when the router itself would route it to one (an empty id, as GET /api/v1/themes/ is)', async () => {
		await server.start()
		const response = await server.inject({ method: 'PATCH', url: '/api/v1/themes/', headers: { authorization: 'Bearer admin' } })
		expect(response.statusCode).toBe(405)
		expect(response.headers['allow']).toBe('GET, PUT, DELETE')
	})
	it('does not take a path that merely ends like a resource for a known resource', async () => {
		await server.start()
		const response = await server.inject({ method: 'PATCH', url: '/prefix/api/v1/themes', headers: { authorization: 'Bearer admin' } })
		expect(response.statusCode).toBe(404)
		expect(response.json()).toEqual(unknownRouteBody)
	})
	afterEach(async () => {
		await server.stop()
	})
});

describe('US-005/CA-53 - US-004/CA-35 - US-003/CA-16 (decisions #31 to #33) - An unsupported method on a public route is answered with 405 directly on the assembled server', () => {
	let server: QuizServer
	beforeEach(() => {
		const protectedThemeConfiguration: ThemeRouteConfiguration = { ...mockThemeRouteConfiguration, middleware: authenticationMiddleware }
		server = new QuizServer(mockQuizServerConfiguration, mockTokenRouteConfiguration, protectedThemeConfiguration, mockWsRouteConfiguration, mockQuestionRouteConfiguration)
	})
	it('answers 405 METHOD_NOT_ALLOWED with Allow: POST on the token route, without a token', async () => {
		await server.start()
		const response = await server.inject({ method: 'PUT', url: '/api/v1/token' })
		expect(response.statusCode).toBe(405)
		expect(response.headers['allow']).toBe('POST')
		expect(response.json()).toEqual({ status: 405, error: 'METHOD_NOT_ALLOWED', message: 'HTTP method PUT is not allowed on this resource.' })
	})
	it.each(['GET', 'DELETE'])('US-003/CA-16 answers 405 METHOD_NOT_ALLOWED with Allow: POST and the standard body to a %s on the token route, without a token', async (method) => {
		await server.start()
		const response = await server.inject({ method: method as 'GET' | 'DELETE', url: '/api/v1/token' })
		expect(response.statusCode).toBe(405)
		expect(response.headers['allow']).toBe('POST')
		expect(response.json()).toEqual({ status: 405, error: 'METHOD_NOT_ALLOWED', message: `HTTP method ${method} is not allowed on this resource.` })
	})
	afterEach(async () => {
		await server.stop()
	})
});

describe('US-003/CA-16 (decisions #90 and #93) - A method other than POST on the token route answers 405 whatever the body on the assembled server', () => {
	let server: QuizServer
	const standardBody = (method: string) => ({ status: 405, error: 'METHOD_NOT_ALLOWED', message: `HTTP method ${method} is not allowed on this resource.` })
	const bodies = [
		['an invalid JSON body', '{bad'],
		['an empty body', ''],
		['a valid JSON body', '{"username":"u","password":"p"}']
	]
	const methods = ['PUT', 'DELETE', 'PATCH', 'OPTIONS'] as const
	beforeEach(() => {
		server = new QuizServer(mockQuizServerConfiguration, mockTokenRouteConfiguration, mockThemeRouteConfiguration, mockWsRouteConfiguration, mockQuestionRouteConfiguration)
	})
	describe.each(methods)('%s', (method) => {
		it.each(bodies)('answers 405 METHOD_NOT_ALLOWED with Allow: POST and the standard body with application/json and %s', async (_label, payload) => {
			await server.start()
			const response = await server.inject({ method, url: '/api/v1/token', headers: { 'content-type': 'application/json' }, payload })
			expect(response.statusCode).toBe(405)
			expect(response.headers['allow']).toBe('POST')
			expect(response.json()).toEqual(standardBody(method))
		})
		it.each([['text/plain'], ['application/xml'], ['application/json; charset=latin1']])('answers 405, never 415, with the Content-Type %s', async (contentType) => {
			await server.start()
			const response = await server.inject({ method, url: '/api/v1/token', headers: { 'content-type': contentType }, payload: '{bad' })
			expect(response.statusCode).toBe(405)
			expect(response.headers['allow']).toBe('POST')
			expect(response.json()).toEqual(standardBody(method))
		})
		it('answers 405 with an invalid JSON body and a query string', async () => {
			await server.start()
			const response = await server.inject({ method, url: '/api/v1/token?x=1', headers: { 'content-type': 'application/json' }, payload: '{bad' })
			expect(response.statusCode).toBe(405)
			expect(response.headers['allow']).toBe('POST')
		})
	})
	it.each(['PUT', 'OPTIONS'] as const)('counts a 405 of a %s with an invalid JSON body in the rate limit and answers 429 once the limit is passed', async (method) => {
		const limitedConfiguration: QuizServerConfiguration = {
			...mockQuizServerConfiguration,
			rateLimitMiddleware: async (app) => { await rateLimitMiddleware(app, { maxRequestsPerMinute: 2 }) }
		}
		const limitedServer = new QuizServer(limitedConfiguration, mockTokenRouteConfiguration, mockThemeRouteConfiguration, mockWsRouteConfiguration, mockQuestionRouteConfiguration)
		await limitedServer.start()
		try {
			const send = () => limitedServer.inject({ method, url: '/api/v1/token', headers: { 'content-type': 'application/json' }, payload: '{bad' })
			const first = await send()
			const second = await send()
			const third = await send()
			expect([first.statusCode, second.statusCode]).toEqual([405, 405])
			expect(third.statusCode).toBe(429)
			expect(third.headers['retry-after']).toBe('60')
			expect(third.json()).toEqual({ status: 429, error: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please retry in 60 seconds.' })
		} finally {
			await limitedServer.stop()
		}
	})
	it('keeps the 400 INVALID_JSON of a POST with an invalid JSON body (control)', async () => {
		await server.start()
		const response = await server.inject({ method: 'POST', url: '/api/v1/token', headers: { 'content-type': 'application/json' }, payload: '{bad' })
		expect(response.statusCode).toBe(400)
		expect(response.json()).toEqual({ status: 400, error: 'INVALID_JSON', message: 'Request body must be valid JSON.' })
	})
	it('keeps the 415 of a POST with a Content-Type other than application/json (control)', async () => {
		await server.start()
		const response = await server.inject({ method: 'POST', url: '/api/v1/token', headers: { 'content-type': 'text/plain' }, payload: 'x' })
		expect(response.statusCode).toBe(415)
	})
	it('keeps the 400 native of a PUT with an invalid JSON body on an unknown route (themes and questions scope not decided, control)', async () => {
		await server.start()
		const response = await server.inject({ method: 'PUT', url: '/api/v1/does-not-exist', headers: { 'content-type': 'application/json' }, payload: '{bad' })
		expect(response.statusCode).toBe(400)
	})
	afterEach(async () => {
		await server.stop()
	})
});

describe('US-003/CA-16 (decision #93) - HEAD on the token route answers 405 whatever the body on the assembled server', () => {
	let server: QuizServer
	beforeEach(() => {
		server = new QuizServer(mockQuizServerConfiguration, mockTokenRouteConfiguration, mockThemeRouteConfiguration, mockWsRouteConfiguration, mockQuestionRouteConfiguration)
	})
	it.each([
		['an invalid JSON body', '{bad'],
		['an empty body', ''],
		['a valid JSON body', '{"username":"u","password":"p"}']
	])('answers 405 with Allow: POST, never the native 400, with application/json and %s', async (_label, payload) => {
		await server.start()
		const response = await server.inject({ method: 'HEAD', url: '/api/v1/token', headers: { 'content-type': 'application/json' }, payload })
		expect(response.statusCode).toBe(405)
		expect(response.headers['allow']).toBe('POST')
	})
	it('answers 405 with Allow: POST without a body and without a Content-Type', async () => {
		await server.start()
		const response = await server.inject({ method: 'HEAD', url: '/api/v1/token' })
		expect(response.statusCode).toBe(405)
		expect(response.headers['allow']).toBe('POST')
	})
	it.each([['text/plain'], ['application/xml'], ['application/json; charset=latin1']])('answers 405, never 415, with an invalid JSON body and the Content-Type %s', async (contentType) => {
		await server.start()
		const response = await server.inject({ method: 'HEAD', url: '/api/v1/token', headers: { 'content-type': contentType }, payload: '{bad' })
		expect(response.statusCode).toBe(405)
		expect(response.headers['allow']).toBe('POST')
	})
	it('answers 405 with an invalid JSON body and a query string', async () => {
		await server.start()
		const response = await server.inject({ method: 'HEAD', url: '/api/v1/token?x=1', headers: { 'content-type': 'application/json' }, payload: '{bad' })
		expect(response.statusCode).toBe(405)
		expect(response.headers['allow']).toBe('POST')
	})
	afterEach(async () => {
		await server.stop()
	})
});

describe('US-005/CA-53 - US-004/CA-35 (decision #92) - An unsupported method on a protected route answers 401, 403 or 405 whatever the body on the assembled server', () => {
	let server: QuizServer
	beforeEach(() => {
		const tokenValidator: TokenValidator = { validateToken: vi.fn((token: string) => token !== 'invalid'), inspectToken: vi.fn() }
		const tokenDecoder: TokenDecoder = { decode: vi.fn((token: string) => ({ role: token === 'admin' ? UserRole.ADMIN : UserRole.PLAYER })) }
		const protectedThemeConfiguration: ThemeRouteConfiguration = { ...mockThemeRouteConfiguration, tokenValidator, tokenDecoder, middleware: authenticationMiddleware }
		const protectedQuestionConfiguration: QuestionRouteConfiguration = { ...mockQuestionRouteConfiguration, tokenValidator, tokenDecoder, middleware: authenticationMiddleware }
		server = new QuizServer(mockQuizServerConfiguration, mockTokenRouteConfiguration, protectedThemeConfiguration, mockWsRouteConfiguration, protectedQuestionConfiguration)
	})
	const themeId = '018e4f5a-0000-0000-0000-000000000000'
	const resources = [
		['/api/v1/themes', 'GET, POST'],
		[`/api/v1/themes/${themeId}`, 'GET, PUT, DELETE'],
		['/api/v1/questions', 'GET, POST'],
		[`/api/v1/questions/${themeId}`, 'GET, PUT, DELETE']
	] as const
	const bodies = [
		['an invalid JSON body', 'application/json', '{bad'],
		['an empty body', 'application/json', ''],
		['an invalid JSON body declared as latin1', 'application/json; charset=latin1', '{bad']
	] as const
	const unauthorizedBody = { status: 401, error: 'UNAUTHORIZED', message: 'Authentication token is missing or invalid.' }
	const forbiddenBody = { status: 403, error: 'FORBIDDEN', message: 'You do not have permission to perform this action.' }
	const notAllowedBody = (method: string) => ({ status: 405, error: 'METHOD_NOT_ALLOWED', message: `HTTP method ${method} is not allowed on this resource.` })
	describe.each(resources)('%s', (url, allow) => {
		describe.each(bodies)('with %s', (_label, contentType, payload) => {
			describe.each(['PATCH', 'OPTIONS'] as const)('%s', (method) => {
				const send = (authorization?: string) => server.inject({ method, url, headers: { 'content-type': contentType, ...(authorization ? { authorization } : {}) }, payload })
				it('answers 401 UNAUTHORIZED, without an Allow header, when the token is missing', async () => {
					await server.start()
					const response = await send()
					expect(response.statusCode).toBe(401)
					expect(response.headers['allow']).toBeUndefined()
					expect(response.json()).toEqual(unauthorizedBody)
				})
				it('answers 401 UNAUTHORIZED, without an Allow header, when the token is invalid', async () => {
					await server.start()
					const response = await send('Bearer invalid')
					expect(response.statusCode).toBe(401)
					expect(response.headers['allow']).toBeUndefined()
					expect(response.json()).toEqual(unauthorizedBody)
				})
				it(method === 'PATCH' ? 'answers 403 FORBIDDEN to a buzzer token, a write method' : 'answers 405 to a buzzer token, a method that is not a write method', async () => {
					await server.start()
					const response = await send('Bearer buzzer')
					if (method === 'PATCH') {
						expect(response.statusCode).toBe(403)
						expect(response.headers['allow']).toBeUndefined()
						expect(response.json()).toEqual(forbiddenBody)
					} else {
						expect(response.statusCode).toBe(405)
						expect(response.headers['allow']).toBe(allow)
						expect(response.json()).toEqual(notAllowedBody(method))
					}
				})
				it('answers 405 METHOD_NOT_ALLOWED with the Allow header to an admin token', async () => {
					await server.start()
					const response = await send('Bearer admin')
					expect(response.statusCode).toBe(405)
					expect(response.headers['allow']).toBe(allow)
					expect(response.json()).toEqual(notAllowedBody(method))
				})
			})
		})
	})
	it.each([
		['POST', `/api/v1/themes/${themeId}`, 'GET, PUT, DELETE'],
		['PUT', '/api/v1/themes', 'GET, POST'],
		['DELETE', '/api/v1/questions', 'GET, POST']
	] as const)('answers 401, 403 then 405 to %s on %s, a supported method of another URL, with an invalid JSON body', async (method, url, allow) => {
		await server.start()
		const send = (authorization?: string) => server.inject({ method, url, headers: { 'content-type': 'application/json', ...(authorization ? { authorization } : {}) }, payload: '{bad' })
		expect((await send()).statusCode).toBe(401)
		expect((await send('Bearer buzzer')).statusCode).toBe(403)
		const admin = await send('Bearer admin')
		expect(admin.statusCode).toBe(405)
		expect(admin.headers['allow']).toBe(allow)
	})
	it.each([
		['a valid JSON body', 'application/json', '{"name":"x"}'],
		['a text/plain body', 'text/plain', '{bad'],
		['an application/xml body', 'application/xml', '<bad'],
		['an application/json body declared as latin1', 'application/json; charset=latin1', '{"name":"x"}']
	])('keeps answering 401, 403 then 405 with %s (already compliant)', async (_label, contentType, payload) => {
		await server.start()
		const send = (authorization?: string) => server.inject({ method: 'PATCH', url: '/api/v1/themes', headers: { 'content-type': contentType, ...(authorization ? { authorization } : {}) }, payload })
		expect((await send()).statusCode).toBe(401)
		expect((await send('Bearer buzzer')).statusCode).toBe(403)
		expect((await send('Bearer admin')).statusCode).toBe(405)
	})
	it('keeps answering 401, 403 then 405 without a Content-Type (already compliant)', async () => {
		await server.start()
		const send = (authorization?: string) => server.inject({ method: 'PATCH', url: '/api/v1/themes', headers: authorization ? { authorization } : {}, payload: '{bad' })
		expect((await send()).statusCode).toBe(401)
		expect((await send('Bearer buzzer')).statusCode).toBe(403)
		expect((await send('Bearer admin')).statusCode).toBe(405)
	})
	it.each(['/api/v1/themes', '/api/v1/questions'])('keeps answering 405 to HEAD on %s with an invalid JSON body (already compliant)', async (url) => {
		await server.start()
		const response = await server.inject({ method: 'HEAD', url, headers: { 'content-type': 'application/json', authorization: 'Bearer admin' }, payload: '{bad' })
		expect(response.statusCode).toBe(405)
		expect(response.headers['allow']).toBe('GET, POST')
	})
	it('keeps the native 400 of a POST with an invalid JSON body on a supported method of questions (control, INVALID_JSON debt kept)', async () => {
		await server.start()
		const response = await server.inject({ method: 'POST', url: '/api/v1/questions', headers: { 'content-type': 'application/json', authorization: 'Bearer admin' }, payload: '{bad' })
		expect(response.statusCode).toBe(400)
		expect(response.json()).toMatchObject({ error: 'Bad Request' })
	})
	it('keeps the 415 of a POST with a Content-Type other than application/json on a supported method (control)', async () => {
		await server.start()
		const response = await server.inject({ method: 'POST', url: '/api/v1/questions', headers: { 'content-type': 'application/xml', authorization: 'Bearer admin' }, payload: '<bad' })
		expect(response.statusCode).toBe(415)
	})
	it('counts a 401 on an unsupported method with an invalid JSON body in the rate limit and answers 429 once the limit is passed', async () => {
		const limitedConfiguration: QuizServerConfiguration = {
			...mockQuizServerConfiguration,
			rateLimitMiddleware: async (app) => { await rateLimitMiddleware(app, { maxRequestsPerMinute: 2 }) }
		}
		const limitedServer = new QuizServer(limitedConfiguration, mockTokenRouteConfiguration, mockThemeRouteConfiguration, mockWsRouteConfiguration, mockQuestionRouteConfiguration)
		await limitedServer.start()
		try {
			const send = () => limitedServer.inject({ method: 'PATCH', url: '/api/v1/themes', headers: { 'content-type': 'application/json' }, payload: '{bad' })
			const first = await send()
			const second = await send()
			const third = await send()
			expect([first.statusCode, second.statusCode]).toEqual([401, 401])
			expect(third.statusCode).toBe(429)
			expect(third.headers['retry-after']).toBe('60')
			expect(third.json()).toEqual({ status: 429, error: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please retry in 60 seconds.' })
		} finally {
			await limitedServer.stop()
		}
	})
	afterEach(async () => {
		await server.stop()
	})
});
