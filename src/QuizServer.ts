import Fastify, { FastifyInstance, LightMyRequestResponse } from 'fastify'
import { IQuizServerConfiguration } from './IQuizServerConfiguration'
import healthRoute from './routes/healthRoute'
import tokenRoute from './routes/tokenRoute'
import { IAuthenticationService } from './authentication/IAuthenticationService'
import { ITokenGenerator } from './authentication/ITokenGenerator'

export class QuizServer {
    private app: FastifyInstance
    private configuration : IQuizServerConfiguration
    private authenticationService: IAuthenticationService
    private tokenGenerator: ITokenGenerator

    constructor(configuration : IQuizServerConfiguration, authenticationService: IAuthenticationService, tokenGenerator: ITokenGenerator) {
        this.app = Fastify()
        this.configuration = configuration
        this.authenticationService = authenticationService
        this.tokenGenerator = tokenGenerator
    }

	async start() : Promise<void> {
        this.registerRoutes()
        await this.app.listen({ port: this.configuration.port, host: '0.0.0.0' })
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
        this.app.register(healthRoute);
        this.app.register(tokenRoute, { authService: this.authenticationService, tokenGenerator: this.tokenGenerator });
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