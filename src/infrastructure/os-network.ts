import * as os from 'os'
import { Network } from '../common/network.interface'
import { NetworkInterfaceInfo } from 'os'

export class OsNetwork implements Network {
    networkInterfaces(): NodeJS.Dict<NetworkInterfaceInfo[]> {
        return os.networkInterfaces()
    }
}