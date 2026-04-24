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

const mockClock: Clock = {
	now: () => new Date('2026-04-02T14:32:07')
}

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
const mockUuidValidator: UuidValidator = {
	validate: vi.fn()
};
const mockTokenValidator: TokenValidator = {
	validateToken: vi.fn()
};
const mockMiddleware: (app: FastifyInstance, options: { tokenValidator: TokenValidator }) => Promise<void> = async (app, options) => {};
const mockRateLimitMiddleware: (app: FastifyInstance) => Promise<void> = async (app) => {};

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

describe('CA-1 - Le serveur démarre sans erreur', () => {
	let server: QuizServer
	beforeEach(() => {
		server = new QuizServer(mockQuizServerConfiguration, mockTokenRouteConfiguration, mockThemeRouteConfiguration);
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
		server = new QuizServer(mockQuizServerConfiguration, mockTokenRouteConfiguration, mockThemeRouteConfiguration);
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
		server = new QuizServer(mockQuizServerConfiguration, mockTokenRouteConfiguration, mockThemeRouteConfiguration);
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
		server = new QuizServer(configWithNoIP, mockTokenRouteConfiguration, mockThemeRouteConfiguration);
	})
	it('should display a fallback message if no IP address is found', async () => {
		await server.start()
		expect(spy).toHaveBeenCalledWith('⚠️ No network interface found, listening on http://localhost:3000')
	})
	afterEach(async () => {
		await server.stop()
	})
})