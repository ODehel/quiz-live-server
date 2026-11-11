import { Clock } from './common/clock.interface'
import { Network } from './common/network.interface'
import { FastifyInstance } from 'fastify'

export interface QuizServerConfiguration {
    clock : Clock
    network : Network
    port : number
    rateLimitMiddleware : (app: FastifyInstance) => Promise<void>
}
