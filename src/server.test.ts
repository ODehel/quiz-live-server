import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { QuizServer } from './QuizServer'
import { IClock } from './common/IClock'
import { INetwork } from './common/INetwork'
import { IQuizServerConfiguration } from './IQuizServerConfiguration'

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

const port : number = 3000

const mockQuizServerConfiguration: IQuizServerConfiguration = {
	clock: mockClock,
	network: mockNetwork,
	port: port
}

describe('CA-1 - Le serveur démarre sans erreur', () => {
	let server : QuizServer
	beforeEach(() => {
		server = new QuizServer(mockQuizServerConfiguration)
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
	let server : QuizServer
	let spy : any
	beforeEach(() => {
		spy = vi.spyOn(console, 'log')
		server = new QuizServer(mockQuizServerConfiguration)
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
	let server : QuizServer
	let spy : any
	beforeEach(() => {
		spy = vi.spyOn(console, 'log')
		server = new QuizServer(mockQuizServerConfiguration)
	})
	it('should display a message with current hour within console', async () => {
		await server.start()
		expect(spy).toHaveBeenCalledWith('📡 Listening on http://192.168.1.42:3000')
	})	
	afterEach(async () => {
		await server.stop()
	})
})