import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { QuizServer } from './QuizServer'
import { IClock } from './common/IClock'
import { INetwork } from './common/INetwork'
import { QuizServerConfiguration } from './quiz-server-configuration.interface'
import { IToken } from './authentication/IToken'
import { IUser } from './users/IUser'

const mockClock: IClock = {
	now: () => new Date('2026-04-02T14:32:07')
}

const mockNetwork: INetwork = {
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
	generateToken: (user: IUser) => {
		return { token: 'generated-token' } as IToken;
	}
};

describe('CA-1 - Le serveur démarre sans erreur', () => {
	let server: QuizServer
	beforeEach(() => {
		server = new QuizServer(mockQuizServerConfiguration, mockAuthenticationService, mockTokenGenerator)
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
		server = new QuizServer(mockQuizServerConfiguration, mockAuthenticationService, mockTokenGenerator)
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
		server = new QuizServer(mockQuizServerConfiguration, mockAuthenticationService, mockTokenGenerator)
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
		const mockNetworkNoIP: INetwork = {
			networkInterfaces: () => ({})
		}
		const configWithNoIP: QuizServerConfiguration = {
			...mockQuizServerConfiguration,
			network: mockNetworkNoIP
		}
		server = new QuizServer(configWithNoIP, mockAuthenticationService, mockTokenGenerator)
	})
	it('should display a fallback message if no IP address is found', async () => {
		await server.start()
		expect(spy).toHaveBeenCalledWith('⚠️ No network interface found, listening on http://localhost:3000')
	})
	afterEach(async () => {
		await server.stop()
	})
})