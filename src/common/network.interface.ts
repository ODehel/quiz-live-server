import { NetworkInterfaceInfo } from 'os'

export interface Network {
    networkInterfaces(): NodeJS.Dict<NetworkInterfaceInfo[]>
}