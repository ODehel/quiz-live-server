import Fastify, { FastifyInstance, LightMyRequestResponse } from 'fastify'
import { IQuizServerConfiguration } from './IQuizServerConfiguration'

export class QuizServer {
    private app: FastifyInstance
    private configuration : IQuizServerConfiguration

    constructor(configuration : IQuizServerConfiguration) {
        this.app = Fastify()
        this.configuration = configuration
    }

	async start() : Promise<void> {
        this.registerRoutes()
        console.log("🚀 Server started at " + this.formatDateNow())
        console.log(this.formatMessageWithIpAndPort())
	}

	async inject(endpoint : string) : Promise<LightMyRequestResponse> {
        return await this.app.inject(endpoint)
	}

	async stop() : Promise<void> {
        await this.app.close()
	}

    private registerRoutes() {
        this.app.get('/health', async () => {
            return { status: 'ok' }
        })
    }

    private formatDateNow() {
        const date = this.configuration.clock.now()
        const hh = date.getHours().toString().padStart(2, '0')
        const mm = date.getMinutes().toString().padStart(2, '0')
        const ss = date.getSeconds().toString().padStart(2, '0')
        const time = `${hh}:${mm}:${ss}`
        return time
    }

    private formatMessageWithIpAndPort() {
        const allInterfaces = Object.values(this.configuration.network.networkInterfaces()).flat()
        const firstInterface = allInterfaces.find(iface => iface?.family === 'IPv4' && !iface.internal)
        if (!firstInterface) return `⚠️ No network interface found, listening on http://localhost:${this.configuration.port}`
        
        return `📡 Listening on http://${firstInterface.address}:${this.configuration.port}`
    }
}