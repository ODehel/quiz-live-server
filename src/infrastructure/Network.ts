import * as os from 'os'
import { INetwork } from '../common/INetwork'
import { NetworkInterfaceInfo } from 'os'

export class Network implements INetwork {
    networkInterfaces(): NodeJS.Dict<NetworkInterfaceInfo[]> {
        return os.networkInterfaces()
    }
}