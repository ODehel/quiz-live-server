import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { connect, createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// `npm start` runs `tsx src/index.ts`: these tests start the same entry point in a child process
// and observe it from outside (exit code, console, open port). The rule on PORT is proved
// by read-port.test.ts; here we prove that index.ts applies it.
const TSX_CLI = resolve(__dirname, '../node_modules/tsx/dist/cli.mjs')
const INDEX = resolve(__dirname, 'index.ts')
const JWT_SECRET = 'j'.repeat(32)
const DEFAULT_PORT = 3000
const WAIT_MS = 20_000
const TEST_TIMEOUT_MS = 30_000

interface Exit {
    code: number | null
    signal: NodeJS.Signals | null
}

interface Hub {
    child: ChildProcess
    console: () => string
    exited: Promise<Exit>
}

let workDirectory: string
let hubs: Hub[]

beforeEach(() => {
    workDirectory = mkdtempSync(join(tmpdir(), 'quiz-hub-startup-'))
    hubs = []
})

afterEach(async () => {
    hubs.forEach(killProcessTree)
    await Promise.all(hubs.map(hub => hub.exited))
    rmSync(workDirectory, { recursive: true, force: true, maxRetries: 5 })
})

// The environment is explicit, so that the result depends neither on a .env nor on the machine.
// The working directory is the temporary one, so that no .env of the repository is read either.
function startHub(port: string): Hub {
    const child = spawn(process.execPath, [TSX_CLI, INDEX], {
        cwd: workDirectory,
        env: { JWT_SECRET, SQLITE_DB_PATH: join(workDirectory, 'hub.db'), PORT: port },
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: process.platform !== 'win32',
        windowsHide: true
    })
    let output = ''
    child.stdout?.on('data', (chunk: Buffer) => { output += chunk.toString() })
    child.stderr?.on('data', (chunk: Buffer) => { output += chunk.toString() })
    const exited = new Promise<Exit>(done => child.on('close', (code, signal) => done({ code, signal })))
    const hub = { child, console: () => output, exited }
    hubs.push(hub)
    return hub
}

// tsx starts the program in a second process: the whole tree must go, or a hub would stay on its port.
function killProcessTree(hub: Hub): void {
    const pid = hub.child.pid
    if (pid === undefined || hub.child.exitCode !== null || hub.child.signalCode !== null) return
    if (process.platform === 'win32') {
        spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'])
    } else {
        try { process.kill(-pid, 'SIGKILL') } catch { /* the group is already gone */ }
    }
}

async function exitOf(hub: Hub): Promise<Exit> {
    const timeout = new Promise<'timeout'>(done => setTimeout(() => done('timeout'), WAIT_MS))
    const result = await Promise.race([hub.exited, timeout])
    if (result === 'timeout') throw new Error('The hub is still running after ' + WAIT_MS + ' ms. Console: ' + hub.console())
    return result
}

function canConnect(port: number): Promise<boolean> {
    return new Promise(done => {
        const socket = connect({ host: '127.0.0.1', port })
        socket.once('connect', () => { socket.destroy(); done(true) })
        socket.once('error', () => { socket.destroy(); done(false) })
    })
}

async function waitUntilListening(hub: Hub, port: number): Promise<void> {
    const deadline = Date.now() + WAIT_MS
    let stopped = false
    void hub.exited.then(() => { stopped = true })
    while (Date.now() < deadline) {
        if (await canConnect(port)) return
        if (stopped) throw new Error('The hub stopped before listening on ' + port + '. Console: ' + hub.console())
        await new Promise(done => setTimeout(done, 100))
    }
    throw new Error('The hub is not listening on ' + port + ' after ' + WAIT_MS + ' ms. Console: ' + hub.console())
}

async function freePort(): Promise<number> {
    for (;;) {
        const port = await new Promise<number>((done, fail) => {
            const probe = createServer()
            probe.once('error', fail)
            probe.listen(0, '127.0.0.1', () => {
                const address = probe.address()
                probe.close(() => done(typeof address === 'object' && address !== null ? address.port : 0))
            })
        })
        if (port !== 0 && port !== DEFAULT_PORT) return port
    }
}

describe('hub startup', () => {
    it('US-001/CA-5 listens on the port written in PORT', async () => {
        const port = await freePort()

        const hub = startHub(String(port))

        await waitUntilListening(hub, port)
        expect(hub.console()).toContain(':' + port)
    }, TEST_TIMEOUT_MS)

    it.each(['', 'abc', '8080abc', '65536', '0'])('US-001/CA-7 refuses to start when PORT is %j: exit code 1 and a message naming PORT and its rule', async (invalidPort) => {
        const hub = startHub(invalidPort)

        const exit = await exitOf(hub)

        expect(exit).toEqual({ code: 1, signal: null })
        expect(hub.console()).toContain('PORT')
        expect(hub.console()).toContain('1')
        expect(hub.console()).toContain('65535')
    }, TEST_TIMEOUT_MS)

    it.each(['abc', '8080abc', '65536'])('US-001/CA-7 does not repeat the invalid PORT %j in the console', async (invalidPort) => {
        const hub = startHub(invalidPort)

        await exitOf(hub)

        expect(hub.console()).not.toContain(invalidPort)
    }, TEST_TIMEOUT_MS)

    it.each(['abc', '65536'])('US-001/CA-7 never starts listening when PORT is %j', async (invalidPort) => {
        const hub = startHub(invalidPort)

        await exitOf(hub)

        expect(hub.console()).not.toContain('Server started')
        expect(hub.console()).not.toContain('Listening on')
        expect(await canConnect(DEFAULT_PORT)).toBe(false)
    }, TEST_TIMEOUT_MS)
})
