import { Clock } from './common/clock.interface'
import { Network } from './common/network.interface'

export interface QuizServerConfiguration {
    clock : Clock
    network : Network
    port : number
}