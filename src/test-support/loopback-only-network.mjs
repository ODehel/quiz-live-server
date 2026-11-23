// Test-only module, preloaded into the real hub (`NODE_OPTIONS=--import=<this file>`) by src/index.test.ts.
// It changes no behaviour of the hub but one observation: `os.networkInterfaces()` answers a machine that has only a loopback IPv4 interface
// and a non-loopback IPv6 one, whatever the real machine has, so that the fallback of the startup message (US-001 CA-4) is reached on any machine.
// It is inert without LOOPBACK_ONLY_NETWORK=1, and it is never loaded by production code.
import { createRequire } from 'node:module'

if (process.env.LOOPBACK_ONLY_NETWORK === '1') {
    const require = createRequire(import.meta.url)
    const os = require('node:os')
    os.networkInterfaces = () => ({
        lo: [{ address: '127.0.0.1', netmask: '255.0.0.0', family: 'IPv4', mac: '00:00:00:00:00:00', internal: true, cidr: '127.0.0.1/8' }],
        eth0: [{ address: 'fe80::1', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', mac: '02:00:00:00:00:01', internal: false, cidr: 'fe80::1/64', scopeid: 1 }]
    })
    require('node:module').syncBuiltinESMExports()
}
