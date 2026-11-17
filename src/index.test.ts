import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
    errors: () => string
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
function startHub(port: string, overrides: Record<string, string> = {}): Hub {
    const child = spawn(process.execPath, [TSX_CLI, INDEX], {
        cwd: workDirectory,
        env: { JWT_SECRET, SQLITE_DB_PATH: join(workDirectory, 'hub.db'), PORT: port, ...overrides },
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: process.platform !== 'win32',
        windowsHide: true
    })
    let output = ''
    let errors = ''
    child.stdout?.on('data', (chunk: Buffer) => { output += chunk.toString() })
    child.stderr?.on('data', (chunk: Buffer) => { output += chunk.toString(); errors += chunk.toString() })
    const exited = new Promise<Exit>(done => child.on('close', (code, signal) => done({ code, signal })))
    const hub = { child, console: () => output, errors: () => errors, exited }
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

// Another process holds the port, on every IPv4 interface like the hub, until the test ends.
async function occupyPort(): Promise<{ port: number, release: () => Promise<void> }> {
    const holder = createServer()
    const port = await new Promise<number>((done, fail) => {
        holder.once('error', fail)
        holder.listen(0, '0.0.0.0', () => {
            const address = holder.address()
            done(typeof address === 'object' && address !== null ? address.port : 0)
        })
    })
    return { port, release: () => new Promise<void>(done => holder.close(() => done())) }
}

describe('hub startup: port already in use', () => {
    it('US-001/CA-8 refuses to start when the port is already in use: exit code 1, the system cause on the error output', async () => {
        const holder = await occupyPort()
        try {
            const hub = startHub(String(holder.port))

            const exit = await exitOf(hub)

            expect(exit).toEqual({ code: 1, signal: null })
            expect(hub.errors()).toMatch(STARTUP_FAILURE)
            expect(hub.errors()).toContain('EADDRINUSE')
            expect(hub.errors()).not.toMatch(STACK_TRACE)
        } finally {
            await holder.release()
        }
    }, TEST_TIMEOUT_MS)

    it('US-001/CA-8 does not announce a start when the port is already in use', async () => {
        const holder = await occupyPort()
        try {
            const hub = startHub(String(holder.port))

            await exitOf(hub)

            expect(hub.console()).not.toContain('Server started')
            expect(hub.console()).not.toContain('Listening on')
        } finally {
            await holder.release()
        }
    }, TEST_TIMEOUT_MS)
})

const SQLITE_DB_PATH_REFUSAL = 'Server starting failed: SQLITE_DB_PATH cannot be empty or made only of whitespace.'
// Any message that gives the cause the system gives: a non-empty cause after the prefix.
const STARTUP_FAILURE = /^Server starting failed: \S/m
// A stack trace of an uncaught error: the refusal is a message, not a crash.
const STACK_TRACE = /\n\s+at /

describe('hub startup: SQLITE_DB_PATH', () => {
    it.each(['', ' ', '   ', '\t', '\n', '\r', ' \t\r\n', '\u00A0', '\u3000', '\uFEFF'])('US-001/CA-10 refuses to start when SQLITE_DB_PATH is %j: exit code 1, the message on the error output, no file created', async (blankPath) => {
        const port = await freePort()
        const hub = startHub(String(port), { SQLITE_DB_PATH: blankPath })

        const exit = await exitOf(hub)

        expect(exit).toEqual({ code: 1, signal: null })
        expect(hub.errors()).toContain(SQLITE_DB_PATH_REFUSAL)
        expect(hub.console()).not.toContain('Server started')
        expect(hub.console()).not.toContain('Listening on')
        expect(await canConnect(port)).toBe(false)
        expect(readdirSync(workDirectory)).toEqual([])
    }, TEST_TIMEOUT_MS)

    it('US-001/CA-10 does not repeat the blank value in the message', async () => {
        const hub = startHub(String(await freePort()), { SQLITE_DB_PATH: '\t\t\t' })

        await exitOf(hub)

        expect(hub.errors()).not.toContain('\t')
    }, TEST_TIMEOUT_MS)

    it('US-001/CA-10 reports the JWT error first when SQLITE_DB_PATH is blank too', async () => {
        const hub = startHub(String(await freePort()), { SQLITE_DB_PATH: ' ', JWT_SECRET: 'short' })

        const exit = await exitOf(hub)

        expect(exit.code).toBe(1)
        expect(hub.errors()).toContain('JWT_SECRET')
        expect(hub.errors()).not.toContain('SQLITE_DB_PATH')
    }, TEST_TIMEOUT_MS)

    it('US-001/CA-10 reports the PORT error first when SQLITE_DB_PATH is blank too', async () => {
        const hub = startHub('abc', { SQLITE_DB_PATH: ' ' })

        const exit = await exitOf(hub)

        expect(exit.code).toBe(1)
        expect(hub.errors()).toContain('PORT')
        expect(hub.errors()).not.toContain('SQLITE_DB_PATH')
    }, TEST_TIMEOUT_MS)

    it('US-001/CA-10 does not refuse :memory:, bordered or not: the hub listens and no file is created', async () => {
        const port = await freePort()
        const hub = startHub(String(port), { SQLITE_DB_PATH: ' :memory: ' })

        await waitUntilListening(hub, port)

        expect(readdirSync(workDirectory)).toEqual([])
    }, TEST_TIMEOUT_MS)

    it('US-001/CA-10 uses the path without the whitespace around it', async () => {
        const port = await freePort()
        const hub = startHub(String(port), { SQLITE_DB_PATH: '\t\u3000' + join(workDirectory, 'bordered.db') + '\uFEFF \r\n' })

        await waitUntilListening(hub, port)

        expect(readdirSync(workDirectory)).toEqual(['bordered.db'])
    }, TEST_TIMEOUT_MS)
})

describe('hub startup: unusable database', () => {
    const TEXT = 'this is a text file, not a SQLite database'

    function unusableDatabase(kind: 'missing directory' | 'directory' | 'text file'): string {
        if (kind === 'missing directory') return join(workDirectory, 'missing-directory', 'hub.db')
        if (kind === 'directory') {
            const directory = join(workDirectory, 'a-directory')
            mkdirSync(directory)
            return directory
        }
        const textFile = join(workDirectory, 'notes.db')
        writeFileSync(textFile, TEXT)
        return textFile
    }

    it.each(['missing directory', 'directory', 'text file'] as const)('US-001/CA-9 refuses to start on a %s: exit code 1, the cause on the error output, nothing listens', async (kind) => {
        const port = await freePort()
        const hub = startHub(String(port), { SQLITE_DB_PATH: unusableDatabase(kind) })

        const exit = await exitOf(hub)

        expect(exit).toEqual({ code: 1, signal: null })
        expect(hub.errors()).toMatch(STARTUP_FAILURE)
        expect(hub.errors()).not.toMatch(STACK_TRACE)
        expect(hub.console()).not.toContain('Server started')
        expect(hub.console()).not.toContain('Listening on')
        expect(await canConnect(port)).toBe(false)
    }, TEST_TIMEOUT_MS)

    it('US-001/CA-9 leaves a file that is not a SQLite database untouched', async () => {
        const textFile = unusableDatabase('text file')
        const hub = startHub(String(await freePort()), { SQLITE_DB_PATH: textFile })

        await exitOf(hub)

        expect(readFileSync(textFile, 'utf8')).toBe(TEXT)
    }, TEST_TIMEOUT_MS)

    it('US-001/CA-9 reports the PORT error first when the database cannot be used either', async () => {
        const hub = startHub('abc', { SQLITE_DB_PATH: join(workDirectory, 'missing-directory', 'hub.db') })

        await exitOf(hub)

        expect(hub.errors()).toContain('PORT')
        expect(hub.errors()).not.toContain('database')
    }, TEST_TIMEOUT_MS)

    it('US-001/CA-9 still starts on a database file that does not exist yet, in an existing directory', async () => {
        const port = await freePort()
        const hub = startHub(String(port), { SQLITE_DB_PATH: join(workDirectory, 'new.db') })

        await waitUntilListening(hub, port)

        expect(readdirSync(workDirectory)).toEqual(['new.db'])
    }, TEST_TIMEOUT_MS)

    it('US-001/CA-9 still starts on an existing database file of zero bytes', async () => {
        const emptyFile = join(workDirectory, 'empty.db')
        writeFileSync(emptyFile, '')
        const port = await freePort()
        const hub = startHub(String(port), { SQLITE_DB_PATH: emptyFile })

        await waitUntilListening(hub, port)
    }, TEST_TIMEOUT_MS)
})
