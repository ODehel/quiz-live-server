import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { QuizServer } from './quiz-server'
import { Clock } from './common/clock.interface'
import { Network } from './common/network.interface'
import { QuizServerConfiguration } from './quiz-server-configuration.interface'
import { Token } from './authentication/token.interface'
import { User } from './users/user.interface'
import { ThemeService } from './themes/theme-service.interface'
import { UuidValidator } from './common/uuid-validator.interface'
import { TokenValidator } from './authentication/token-validator.interface'
import { FastifyInstance } from 'fastify'
import { TokenRouteConfiguration } from './authentication/token-route-configuration.interface'
import { ThemeRouteConfiguration } from './themes/theme-route-configuration.interface'
import { TokenDecoder } from './authentication/token-decoder.interface'
import { DecodedToken } from './authentication/decoded-token.interface'
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
import { Question } from './questions/question.interface'

const mockClock: Clock = {
	now: () => new Date('2026-04-02T14:32:07')
}

let capturedCallback: () => void;
let mockScheduler: Scheduler = {
	schedule: vi.fn(() => ({ cancel: () => { } }))
};
let mockSubjectExtractor: SubjectExtractor = {
	extract: vi.fn()
};
let mockExpirationExtractor: ExpirationExtractor = {
	extract: vi.fn()
};
let mockParticipantResolver: ParticipantResolver = {
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
	port: port
}

const mockAuthenticationService = {
	authenticate: vi.fn().mockResolvedValue({ id: 'user-id', username: 'User Name', password: 'user-password', role: 'PLAYER' })
};

const mockTokenGenerator = {
	generateToken: (user: User) => {
		return { token: 'generated-token' } as Token;
	}
};

const mockTokenDecoder: TokenDecoder = {
	decode: vi.fn().mockReturnValue({ role: UserRole.PLAYER } as DecodedToken)
};

const mockThemeService: ThemeService = {
	createTheme: vi.fn(),
	deleteTheme: vi.fn(),
	getAll: vi.fn(),
	getById: vi.fn(),
	updateTheme: vi.fn()
};
const mockQuestionService: QuestionService = {
	createQuestion: vi.fn()
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
const mockMiddleware: (app: FastifyInstance, options: { tokenValidator: TokenValidator }) => Promise<void> = async (app, options) => { };
const mockRateLimitMiddleware: (app: FastifyInstance) => Promise<void> = async (app) => { };

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
	let spy: any
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
	let spy: any
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
	let spy: any
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
			createQuestion: vi.fn().mockReturnValue({ id: '019d92d2-e1f6-7d05-9803-3948dbc4c416' } as Question) // corps prouvé au niveau route, pas ici
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
