import { IClock } from './common/IClock'
import { INetwork } from './common/INetwork'

export interface IQuizServerConfiguration {
    clock : IClock
    network : INetwork
    port : number
}