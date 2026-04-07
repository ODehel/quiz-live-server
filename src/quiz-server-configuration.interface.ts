import { IClock } from './common/IClock'
import { INetwork } from './common/INetwork'

export interface QuizServerConfiguration {
    clock : IClock
    network : INetwork
    port : number
}