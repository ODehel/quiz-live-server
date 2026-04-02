import { NetworkInterfaceInfo } from 'os'

export interface INetwork {
    networkInterfaces(): NodeJS.Dict<NetworkInterfaceInfo[]>
}