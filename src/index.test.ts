import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import Database from 'better-sqlite3'
import jwt from 'jsonwebtoken'
import { connect, createServer } from 'node:net'
import { networkInterfaces, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// `npm start` runs `tsx src/index.ts`: these tests start the same entry point in a child process
// and observe it from outside (exit code, console, open port). The rule on PORT is proved
// by read-port.test.ts; here we prove that index.ts applies it.
const TSX_CLI = resolve(__dirname, '../node_modules/tsx/dist/cli.mjs')
const INDEX = resolve(__dirname, 'index.ts')
// Preloaded into the hub (`--import`, as a file URL so that a Windows path or a space is no trouble): the machine then has no non-loopback IPv4 interface.
const LOOPBACK_ONLY_NETWORK = { NODE_OPTIONS: '--import=' + pathToFileURL(resolve(__dirname, 'test-support/loopback-only-network.mjs')).href, LOOPBACK_ONLY_NETWORK: '1' }
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
    standardOutput: () => string
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
    restorePermissions(workDirectory)
    rmSync(workDirectory, { recursive: true, force: true, maxRetries: 5 })
})

// A test may leave a read-only file or directory behind: a directory without write permission cannot be emptied, so every
// permission is given back before the removal (a no-op for what the tests never restricted).
function restorePermissions(path: string): void {
    try {
        const isDirectory = statSync(path).isDirectory()
        chmodSync(path, isDirectory ? 0o755 : 0o644)
        if (isDirectory) readdirSync(path).forEach(name => restorePermissions(join(path, name)))
    } catch { /* already gone, or not ours to change: the removal reports what matters */ }
}

// The environment is explicit, so that the result depends neither on a .env nor on the machine.
// The working directory is the temporary one, so that no .env of the repository is read either.
// An override valued undefined removes the variable from the environment of the hub.
function startHub(port: string, overrides: Record<string, string | undefined> = {}): Hub {
    const environment = { JWT_SECRET, SQLITE_DB_PATH: join(workDirectory, 'hub.db'), PORT: port, ...overrides }
    const child = spawn(process.execPath, [TSX_CLI, INDEX], {
        cwd: workDirectory,
        env: Object.fromEntries(Object.entries(environment).filter(([, value]) => value !== undefined)),
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: process.platform !== 'win32',
        windowsHide: true
    })
    let output = ''
    let errors = ''
    let standardOutput = ''
    child.stdout?.on('data', (chunk: Buffer) => { output += chunk.toString(); standardOutput += chunk.toString() })
    child.stderr?.on('data', (chunk: Buffer) => { output += chunk.toString(); errors += chunk.toString() })
    const exited = new Promise<Exit>(done => child.on('close', (code, signal) => done({ code, signal })))
    const hub = { child, console: () => output, errors: () => errors, standardOutput: () => standardOutput, exited }
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

function canConnect(port: number, host = '127.0.0.1'): Promise<boolean> {
    return new Promise(done => {
        const socket = connect({ host, port })
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

// The port accepts connections slightly before the startup messages are written: wait for the message itself.
async function waitForStandardOutput(hub: Hub, text: string): Promise<void> {
    await waitUntil(() => hub.standardOutput().includes(text), '"' + text + '" was not written on the standard output', hub)
}

async function waitForConsole(hub: Hub, text: string): Promise<void> {
    await waitUntil(() => hub.console().includes(text), '"' + text + '" was not written on the console', hub)
}

async function waitUntil(condition: () => boolean, failure: string, hub: Hub): Promise<void> {
    const deadline = Date.now() + WAIT_MS
    while (!condition()) {
        if (Date.now() > deadline) throw new Error(failure + ' after ' + WAIT_MS + ' ms. Console: ' + hub.console())
        await new Promise(done => setTimeout(done, 50))
    }
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

// The default port of the CA-5 and CA-4 tests below: the probe must see this very process listen on it on every IPv4 interface, as the hub does,
// and find nothing connectable there. Otherwise (occupied, refused) the test is skipped explicitly, never failed: the port is not ours to free.
function defaultPortSkipReason(): string | undefined {
    const script = `
        const net = require('node:net')
        const port = ${DEFAULT_PORT}
        const socket = net.connect({ host: '127.0.0.1', port })
        socket.once('connect', () => { console.log('occupied'); process.exit(0) })
        socket.once('error', () => {
            const server = net.createServer()
            server.once('error', error => { console.log(error.code); process.exit(0) })
            server.listen(port, '0.0.0.0', () => { console.log('free'); process.exit(0) })
        })`
    const probe = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8', timeout: 10_000 })
    const result = probe.stdout.trim()
    if (result === 'free') return undefined
    if (result === 'occupied') return 'port ' + DEFAULT_PORT + ' is already occupied on this machine'
    return 'port ' + DEFAULT_PORT + ' cannot be opened here (' + (result || 'no answer') + ')'
}

const DEFAULT_PORT_SKIP = defaultPortSkipReason()
if (DEFAULT_PORT_SKIP !== undefined) console.warn('[index.test] SKIPPED the fallback test of the default port: ' + DEFAULT_PORT_SKIP)
const SKIPPED_DEFAULT_PORT = ' (skipped when port ' + DEFAULT_PORT + ' is occupied or cannot be opened on this machine)'

// The first IPv4 address that is not a loopback one: the rule of US-001 CA-3, computed here from the machine
// so that the test depends on no fixed address. Undefined when the machine has no such interface.
const FIRST_NON_LOOPBACK_IPV4 = Object.values(networkInterfaces()).flat()
    .find(entry => entry?.family === 'IPv4' && !entry.internal)?.address
const NO_NON_LOOPBACK_IPV4 = FIRST_NON_LOOPBACK_IPV4 === undefined
const SECONDS_PER_DAY = 86_400

// The startup messages are the standard output lines that are not Fastify's JSON log lines (not prescribed, see US-001):
// those say "Server listening at http://127.0.0.1:<port>" too, which the messages themselves must not.
function startupLines(hub: Hub): string[] {
    return hub.standardOutput().split(/\r?\n/).filter(line => line.trim() !== '' && !line.startsWith('{'))
}

async function waitForStartupAnnouncement(hub: Hub, port: number): Promise<void> {
    await waitUntil(() => startupLines(hub).some(line => line.includes(':' + port)), 'the startup announcement of port ' + port + ' was not written on the standard output', hub)
}

function secondsOfDay(instant: number, timeZone: string): number {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(instant))
    const part = (type: string) => Number(parts.find(candidate => candidate.type === type)?.value)
    return part('hour') * 3600 + part('minute') * 60 + part('second')
}

// Compared as seconds of the day, modulo a day, so that a window that crosses a minute, an hour or midnight is no special case.
function isInWindow(seconds: number, windowStart: number, windowEnd: number): boolean {
    const modulo = (value: number) => ((value % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY
    return modulo(seconds - windowStart) <= modulo(windowEnd - windowStart)
}

describe('hub startup', () => {
    it('US-001/CA-5 listens on the port written in PORT', async () => {
        const port = await freePort()

        const hub = startHub(String(port))

        await waitUntilListening(hub, port)
        await waitForStartupAnnouncement(hub, port)

        expect(startupLines(hub).join('\n')).toContain(':' + port)
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

    it('US-001/CA-5 listens on port 3000 when PORT is absent', async () => {
        const hub = startHub('', { PORT: undefined })

        // Other test files of the run may hold port 3000 for a moment: either the hub listens on it or it names it in its failure.
        // Both prove that 3000 is the port it tries by default.
        await waitForConsole(hub, ':' + DEFAULT_PORT)
    }, TEST_TIMEOUT_MS)

    it('US-001/CA-5 reads the port from a .env file in the working directory when PORT is absent from the environment', async () => {
        const port = await freePort()
        writeFileSync(join(workDirectory, '.env'), 'PORT=' + port + '\n')
        const hub = startHub('', { PORT: undefined })

        await waitUntilListening(hub, port)
    }, TEST_TIMEOUT_MS)

    it('US-001/CA-5 prefers the PORT of the real environment to the PORT of the .env file', async () => {
        const realPort = await freePort()
        const envFilePort = await freePort()
        writeFileSync(join(workDirectory, '.env'), 'PORT=' + envFilePort + '\n')
        const hub = startHub(String(realPort))

        await waitUntilListening(hub, realPort)
        expect(await canConnect(envFilePort)).toBe(false)
    }, TEST_TIMEOUT_MS)

    it('US-001/CA-7 refuses to start when the .env file has an empty PORT and the environment has none', async () => {
        writeFileSync(join(workDirectory, '.env'), 'PORT=\n')
        const hub = startHub('', { PORT: undefined })

        const exit = await exitOf(hub)

        expect(exit).toEqual({ code: 1, signal: null })
        expect(hub.errors()).toMatch(/^Server starting failed: PORT /m)
        expect(hub.console()).not.toContain('Listening on')
    }, TEST_TIMEOUT_MS)

    it('US-001/CA-7 does not read the empty PORT of the .env file when the real environment has a valid one', async () => {
        const port = await freePort()
        writeFileSync(join(workDirectory, '.env'), 'PORT=\n')
        const hub = startHub(String(port))

        await waitUntilListening(hub, port)
    }, TEST_TIMEOUT_MS)

    it.each([
        ['JWT_SECRET', { JWT_SECRET: 'short' }],
        ['JWT_EXPIRATION', { JWT_EXPIRATION: 'abc' }]
    ] as const)('US-001/CA-7 reports only the %s error, with exit code 1, when PORT is invalid too', async (variable, overrides) => {
        const hub = startHub('abc', overrides)

        const exit = await exitOf(hub)

        expect(exit).toEqual({ code: 1, signal: null })
        expect(hub.errors()).toContain(variable)
        expect(hub.errors()).not.toContain('65535')
        expect(hub.errors().match(/Server starting failed:/g)).toHaveLength(1)
    }, TEST_TIMEOUT_MS)

    it.each(['abc', '65536'])('US-001/CA-7 writes the refusal of PORT %j on the error output and not on the standard output', async (invalidPort) => {
        const hub = startHub(invalidPort)

        await exitOf(hub)

        expect(hub.errors()).toMatch(/^Server starting failed: PORT /m)
        expect(hub.standardOutput()).not.toContain('PORT')
    }, TEST_TIMEOUT_MS)

    it('US-001/CA-2 and CA-3 write the startup messages on the standard output and not on the error output', async () => {
        const port = await freePort()
        const hub = startHub(String(port))

        await waitUntilListening(hub, port)
        await waitForStandardOutput(hub, 'Listening on')

        expect(hub.standardOutput()).toContain('Server started')
        expect(hub.standardOutput()).toContain('Listening on')
        expect(hub.errors()).not.toContain('Server started')
        expect(hub.errors()).not.toContain('Listening on')
    }, TEST_TIMEOUT_MS)

    it('US-001/CA-1 keeps running after the announcement without a startup failure or an unhandled error on the error output', async () => {
        const port = await freePort()
        const hub = startHub(String(port))

        await waitUntilListening(hub, port)
        await waitForStartupAnnouncement(hub, port)
        await new Promise(done => setTimeout(done, 500))

        expect(hub.child.exitCode).toBeNull()
        expect(hub.child.signalCode).toBeNull()
        const errors = withoutNodeWarnings(hub.errors())
        expect(errors).not.toMatch(STARTUP_FAILURE_MARK)
        expect(errors).not.toMatch(UNHANDLED_ERROR)
    }, TEST_TIMEOUT_MS)

    // Skipped, never silently green, when the machine has no non-loopback IPv4 interface: the rule needs one to be observed.
    it.skipIf(NO_NON_LOOPBACK_IPV4)('US-001/CA-1 listens on every IPv4 interface: the loopback and the first non-loopback address accept connections (skipped without a non-loopback IPv4 interface)', async () => {
        const port = await freePort()
        const hub = startHub(String(port))

        await waitUntilListening(hub, port)

        expect(await canConnect(port, '127.0.0.1')).toBe(true)
        expect(await canConnect(port, FIRST_NON_LOOPBACK_IPV4)).toBe(true)
    }, TEST_TIMEOUT_MS)

    // Fixed-offset zones without daylight saving, far from UTC: the launch time cannot be mistaken for the UTC one.
    it.each(['Pacific/Kiritimati', 'Pacific/Pago_Pago'])('US-001/CA-2 writes the launch time as HH:mm:ss in the local time of the machine, not in UTC, when TZ is %s', async (timeZone) => {
        const port = await freePort()
        const before = Date.now()
        const hub = startHub(String(port), { TZ: timeZone })

        await waitForStartupAnnouncement(hub, port)
        const after = Date.now()

        const times = startupLines(hub).flatMap(line => line.match(/\b\d{2}:\d{2}:\d{2}\b/g) ?? [])
        expect(times).toHaveLength(1)
        const [hours = NaN, minutes = NaN, seconds = NaN] = (times[0] ?? '').split(':').map(Number)
        const displayed = hours * 3600 + minutes * 60 + seconds
        expect(isInWindow(displayed, secondsOfDay(before, timeZone), secondsOfDay(after, timeZone))).toBe(true)
        expect(isInWindow(displayed, secondsOfDay(before, 'UTC'), secondsOfDay(after, 'UTC'))).toBe(false)
    }, TEST_TIMEOUT_MS)

    // Skipped, never silently green, when the machine has no non-loopback IPv4 interface: the rule needs one to be observed.
    it.skipIf(NO_NON_LOOPBACK_IPV4)('US-001/CA-3 announces the first non-loopback IPv4 address and the port, neither 127.0.0.1 nor localhost (skipped without a non-loopback IPv4 interface)', async () => {
        const port = await freePort()
        const hub = startHub(String(port))

        await waitForStartupAnnouncement(hub, port)

        const announced = new RegExp('(?<![\\d.])' + String(FIRST_NON_LOOPBACK_IPV4).replaceAll('.', '\\.') + ':' + port + '(?!\\d)')
        const lines = startupLines(hub)
        expect(lines.some(line => announced.test(line))).toBe(true)
        expect(lines.filter(line => line.includes('127.0.0.1') || line.toLowerCase().includes('localhost'))).toEqual([])
    }, TEST_TIMEOUT_MS)

    // Not skipped without a network interface: the interfaces seen by the hub are the ones of src/test-support/loopback-only-network.mjs (a loopback IPv4 and a non-loopback IPv6).
    // PORT absent (3000) is proved by the next test, which a probe skips when 3000 is occupied.
    it('US-001/CA-4 writes the fallback message on the standard output with localhost and the configured port when no non-loopback IPv4 interface is found', async () => {
        const port = await freePort()
        const hub = startHub(String(port), LOOPBACK_ONLY_NETWORK)

        await waitUntilListening(hub, port)
        await waitForStartupAnnouncement(hub, port)

        expect(startupLines(hub).filter(line => line.includes('localhost:' + port))).toHaveLength(1)
        expect(startupLines(hub).filter(line => line.includes(':' + DEFAULT_PORT))).toEqual([])
        expect(hub.errors()).not.toContain('localhost')
    }, TEST_TIMEOUT_MS)

    it.skipIf(DEFAULT_PORT_SKIP !== undefined)('US-001/CA-4 and CA-5 write the fallback message with localhost and port 3000 on the standard output when PORT is absent and no non-loopback IPv4 interface is found' + SKIPPED_DEFAULT_PORT, async () => {
        const hub = startHub('', { ...LOOPBACK_ONLY_NETWORK, PORT: undefined })

        await waitUntilListening(hub, DEFAULT_PORT)
        await waitForStartupAnnouncement(hub, DEFAULT_PORT)

        expect(startupLines(hub).filter(line => line.includes('localhost:' + DEFAULT_PORT))).toHaveLength(1)
        expect(hub.errors()).not.toContain('localhost')
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

// Rows of every table of a database file, by table name.
function rowCounts(databasePath: string): Record<string, number> {
    const database = new Database(databasePath, { readonly: true })
    try {
        const names = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[]
        return Object.fromEntries(names.map(({ name }) => [name, (database.prepare(`SELECT COUNT(*) AS count FROM ${name}`).get() as { count: number }).count]))
    } finally {
        database.close()
    }
}

// A database with the eleven accounts, made by the seed as `npm run seed` does.
function seedAccounts(databasePath: string): void {
    const environment: Record<string, string> = { SEED_PASSWORD_ADMIN: 'an-admin-password-1', BCRYPT_COST: '4', NODE_OPTIONS: '--disable-warning=DEP0205', SQLITE_DB_PATH: databasePath }
    for (let i = 1; i <= 10; i++) environment[`SEED_PASSWORD_BUZZER_${String(i).padStart(2, '0')}`] = `a-buzzer-password-${i}`
    const result = spawnSync(process.execPath, [TSX_CLI, resolve(__dirname, 'seed.ts')], { cwd: workDirectory, env: environment, encoding: 'utf8' })
    if (result.status !== 0) throw new Error('The seed failed: ' + result.stderr)
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

    it.each(['absent', 'zero bytes'] as const)('US-001/CA-8 keeps the database file, with its tables empty, when it was %s and the port is already in use', async (start) => {
        const databasePath = join(workDirectory, 'left.db')
        if (start === 'zero bytes') writeFileSync(databasePath, '')
        const holder = await occupyPort()
        try {
            const hub = startHub(String(holder.port), { SQLITE_DB_PATH: databasePath })

            const exit = await exitOf(hub)

            expect(exit).toEqual({ code: 1, signal: null })
            const counts = rowCounts(databasePath)
            expect(Object.keys(counts)).toContain('T_USER_USR')
            expect(Object.values(counts).every(count => count === 0)).toBe(true)
        } finally {
            await holder.release()
        }
    }, TEST_TIMEOUT_MS)

    it('US-001/CA-8 keeps the accounts of a database that already exists when the port is already in use', async () => {
        const databasePath = join(workDirectory, 'accounts.db')
        seedAccounts(databasePath)
        const holder = await occupyPort()
        try {
            const hub = startHub(String(holder.port), { SQLITE_DB_PATH: databasePath })

            await exitOf(hub)

            expect(rowCounts(databasePath).T_USER_USR).toBe(11)
        } finally {
            await holder.release()
        }
    }, TEST_TIMEOUT_MS)

    it('US-001/CA-8 starts on the next run, with the same database file, once the port is free', async () => {
        const databasePath = join(workDirectory, 'left.db')
        const holder = await occupyPort()
        try {
            await exitOf(startHub(String(holder.port), { SQLITE_DB_PATH: databasePath }))
        } finally {
            await holder.release()
        }
        const port = await freePort()

        const hub = startHub(String(port), { SQLITE_DB_PATH: databasePath })

        await waitUntilListening(hub, port)
    }, TEST_TIMEOUT_MS)
})

// The closed list of the 25 whitespace characters of US-001/CA-10 (decision #61), by code point.
const WHITESPACE_CODE_POINTS = [0x0009, 0x000A, 0x000B, 0x000C, 0x000D, 0x0020, 0x00A0, 0x1680, ...Array.from({ length: 11 }, (_, i) => 0x2000 + i), 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF]
const codePoint = (character: string): string => 'U+' + character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')
// Every blank alone, plus the empty string and two values made of several blanks.
const BLANK_PATHS: Array<[string, string]> = [
    ['an empty string', ''],
    ...WHITESPACE_CODE_POINTS.map((point): [string, string] => [codePoint(String.fromCodePoint(point)), String.fromCodePoint(point)]),
    ['three spaces', '   '],
    ['a mix of blanks', ' \t\r\n']
]
// Not whitespace for the rule, although invisible: alone, each one is a one-character path (decision #61).
const NOT_BLANK_CHARACTERS: Array<[string, string]> = [
    ['U+200B', '\u200B'],
    ['U+0085', '\u0085'],
    ['U+180E', '\u180E']
]

// Beyond U+3100 (decision #61): none of these is in the closed list of 25 blanks, so each one alone is a one-character path.
// U+3101 is the first character above U+3100, U+FF21 a full-width letter (Basic Multilingual Plane), U+1F600 a character outside
// the BMP (two UTF-16 code units). Which characters are sampled is an implementation choice, not an observable behaviour.
const BEYOND_U3100_CHARACTERS: Array<[string, string]> = [
    ['U+3101', '\u3101'],
    ['U+FF21', '\uFF21'],
    ['U+1F600', '\u{1F600}']
]
// A file system that cannot hold a name cannot prove the test: it is skipped explicitly (title and skipIf), never faked. The probe creates the file in a temporary directory.
function filesystemKeepsTheName(character: string): boolean {
    const probeDirectory = mkdtempSync(join(tmpdir(), 'quiz-name-probe-'))
    try {
        writeFileSync(join(probeDirectory, character), '')
        const names = readdirSync(probeDirectory)
        return names.length === 1 && names[0] === character
    } catch {
        return false
    } finally {
        rmSync(probeDirectory, { recursive: true, force: true })
    }
}

const SQLITE_DB_PATH_REFUSAL = 'Server starting failed: SQLITE_DB_PATH cannot be empty or made only of whitespace.'
// Any message that gives the cause the system gives: a non-empty cause after the prefix.
const STARTUP_FAILURE = /^Server starting failed: \S/m
// A stack trace of an uncaught error: the refusal is a message, not a crash.
const STACK_TRACE = /\n\s+at /
// The hub's own failure message, whatever its cause.
const STARTUP_FAILURE_MARK = /Server starting failed/
// An error nobody handled: an uncaught or unhandled exception, an error line, or a stack frame.
const UNHANDLED_ERROR = /uncaught|unhandled|\bError\b|^\s+at /im

// Node and the tsx loader may warn on the error output, whatever the version of Node (for instance DEP0205 on Node 26):
// a warning is not an error of the hub. Only the lines of those warnings are dropped, never a line of the hub.
function withoutNodeWarnings(errors: string): string {
    return errors
        .split('\n')
        .filter(line => !/^\(node:\d+\) .*Warning: /.test(line) && !/^\(Use `node --trace-/.test(line))
        .join('\n')
}

describe('hub startup: SQLITE_DB_PATH', () => {
    it.each(BLANK_PATHS)('US-001/CA-10 refuses to start when SQLITE_DB_PATH is %s: exit code 1, the message on the error output, no file created', async (_name, blankPath) => {
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

    it.each(NOT_BLANK_CHARACTERS)('US-001/CA-10 does not refuse %s alone: the hub listens and a file named by this one character is created', async (_name, character) => {
        const port = await freePort()
        const hub = startHub(String(port), { SQLITE_DB_PATH: character })

        await waitUntilListening(hub, port)

        expect(hub.errors()).not.toContain('SQLITE_DB_PATH')
        expect(readdirSync(workDirectory)).toEqual([character])
    }, TEST_TIMEOUT_MS)

    for (const [name, character] of BEYOND_U3100_CHARACTERS) {
        it.skipIf(!filesystemKeepsTheName(character))('US-001/CA-10 does not refuse ' + name + ' alone, beyond U+3100: the hub listens and announces its start, and a file named by this one character is created (skipped when the file system cannot hold this name)', async () => {
            const port = await freePort()
            const hub = startHub(String(port), { SQLITE_DB_PATH: character })
    
            await waitUntilListening(hub, port)
            await waitForStartupAnnouncement(hub, port)
    
            expect(hub.errors()).not.toContain('SQLITE_DB_PATH')
            expect(readdirSync(workDirectory)).toEqual([character])
        }, TEST_TIMEOUT_MS)
    }

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

    it('US-001/CA-10 refuses to start when the .env file has an empty SQLITE_DB_PATH and the environment has none: exit code 1, the message on the error output, no file created', async () => {
        const port = await freePort()
        writeFileSync(join(workDirectory, '.env'), 'SQLITE_DB_PATH=\n')
        const hub = startHub(String(port), { SQLITE_DB_PATH: undefined })

        const exit = await exitOf(hub)

        expect(exit).toEqual({ code: 1, signal: null })
        expect(hub.errors()).toContain(SQLITE_DB_PATH_REFUSAL)
        expect(hub.errors()).not.toMatch(STACK_TRACE)
        expect(hub.console()).not.toContain('Server started')
        expect(hub.console()).not.toContain('Listening on')
        expect(await canConnect(port)).toBe(false)
        expect(readdirSync(workDirectory)).toEqual(['.env'])
    }, TEST_TIMEOUT_MS)

    it('US-001/CA-10 does not read the empty SQLITE_DB_PATH of the .env file when the real environment has a valid path: the database is created at the real path', async () => {
        const port = await freePort()
        writeFileSync(join(workDirectory, '.env'), 'SQLITE_DB_PATH=\n')
        const hub = startHub(String(port), { SQLITE_DB_PATH: join(workDirectory, 'real.db') })

        await waitUntilListening(hub, port)
        await waitForStartupAnnouncement(hub, port)

        expect(readdirSync(workDirectory).sort()).toEqual(['.env', 'real.db'])
        expect(withoutNodeWarnings(hub.errors())).not.toMatch(STARTUP_FAILURE_MARK)
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

// How a .env file writes SQLITE_DB_PATH (US-001 CA-10, "Origine de la valeur", decision #71). The rule of the hub bears on the value
// the process receives; the .env file is read by the `dotenv` library (17.4.0), and what these tests observe on the real process
// (unquoted values trimmed, quoted values kept, " #" starting a comment) is what that library does, not something the specification
// prescribes. A change of behaviour of a new `dotenv` version would show up here and must be observed again, not silently followed.
// The real environment has no SQLITE_DB_PATH, so the .env file alone writes it. The working directory is the temporary one:
// a relative path of the .env file names a file of this directory.
describe('hub startup: SQLITE_DB_PATH written in a .env file', () => {
    async function startWithEnvFile(content: string): Promise<{ hub: Hub, port: number }> {
        const port = await freePort()
        writeFileSync(join(workDirectory, '.env'), content)
        return { hub: startHub(String(port), { SQLITE_DB_PATH: undefined }), port }
    }

    async function expectRefusedAsBlank(hub: Hub, port: number): Promise<void> {
        const exit = await exitOf(hub)

        expect(exit).toEqual({ code: 1, signal: null })
        expect(hub.errors()).toContain(SQLITE_DB_PATH_REFUSAL)
        // The message is the refusal itself: the line carries no other text, so no value is repeated in it.
        expect(hub.errors().split(/\r?\n/).filter(line => line.startsWith('Server starting failed'))).toEqual([SQLITE_DB_PATH_REFUSAL])
        expect(hub.errors()).not.toMatch(STACK_TRACE)
        expect(hub.console()).not.toContain('Server started')
        expect(hub.console()).not.toContain('Listening on')
        expect(await canConnect(port)).toBe(false)
        expect(readdirSync(workDirectory)).toEqual(['.env'])
    }

    // `file` is the only file the hub creates next to the .env file; null when it creates none.
    async function expectStarted(hub: Hub, port: number, file: string | null): Promise<void> {
        await waitUntilListening(hub, port)
        await waitForStartupAnnouncement(hub, port)

        expect(withoutNodeWarnings(hub.errors())).not.toMatch(STARTUP_FAILURE_MARK)
        expect(readdirSync(workDirectory).sort()).toEqual(file === null ? ['.env'] : ['.env', file].sort())
    }

    it.each([
        ['spaces', '   '],
        ['tabulations', '\t\t'],
        ['U+3000', '　　']
    ] as const)('US-001/CA-10 refuses an unquoted SQLITE_DB_PATH made only of %s, read empty: exit code 1, the message on the error output without the value, no file created', async (_name, blank) => {
        const { hub, port } = await startWithEnvFile('SQLITE_DB_PATH=' + blank + '\n')

        await expectRefusedAsBlank(hub, port)
    }, TEST_TIMEOUT_MS)

    it.each([
        ['keeps the blanks inside an unquoted value: the file is named with them', 'SQLITE_DB_PATH=my data.db', 'my data.db'],
        ['starts a comment at an unquoted " #": the value stops before it', 'SQLITE_DB_PATH=real.db # note', 'real.db'],
        ['keeps the blanks of a quoted value, then reads it without the blanks around it', 'SQLITE_DB_PATH="  padded.db  "', 'padded.db'],
        ['reads a quoted " :memory: " as :memory:: no file is created', 'SQLITE_DB_PATH=" :memory: "', null],
        ['accepts an unquoted :memory:: no file is created', 'SQLITE_DB_PATH=:memory:', null],
        ['accepts an unquoted U+200B alone: the file is named by this one character', 'SQLITE_DB_PATH=​', '​']
    ] as const)('US-001/CA-10 %s', async (_name, line, file) => {
        const { hub, port } = await startWithEnvFile(line + '\n')

        await expectStarted(hub, port, file)
    }, TEST_TIMEOUT_MS)

    it('US-001/CA-10 refuses a quoted SQLITE_DB_PATH made only of spaces: exit code 1, the message on the error output without the value, no file created', async () => {
        const { hub, port } = await startWithEnvFile('SQLITE_DB_PATH="   "\n')

        await expectRefusedAsBlank(hub, port)
    }, TEST_TIMEOUT_MS)
})

const ENV_FILE_VALID_SECRET = 'e'.repeat(32)

describe('hub startup: JWT_SECRET', () => {
    // 31 characters: one short of the rule, and a value no other message of the hub may repeat.
    const TOO_SHORT_SECRET = 'k'.repeat(31)

    it.each([
        ['absent', undefined],
        ['empty', ''],
        ['31 characters long', TOO_SHORT_SECRET]
    ] as const)('US-001/CA-1 refuses to start when JWT_SECRET is %s: exit code 1, the message naming JWT_SECRET and its rule on the error output, no database opened, nothing listens', async (_name, secret) => {
        const port = await freePort()
        const hub = startHub(String(port), { JWT_SECRET: secret })

        const exit = await exitOf(hub)

        expect(exit).toEqual({ code: 1, signal: null })
        expect(hub.errors()).toMatch(/^Server starting failed: JWT_SECRET /m)
        expect(hub.errors()).toContain('32')
        expect(hub.errors()).not.toMatch(STACK_TRACE)
        expect(hub.errors()).not.toContain(TOO_SHORT_SECRET)
        expect(hub.standardOutput()).toBe('')
        expect(hub.console()).not.toContain('Server started')
        expect(hub.console()).not.toContain('Listening on')
        expect(await canConnect(port)).toBe(false)
        expect(readdirSync(workDirectory)).toEqual([])
    }, TEST_TIMEOUT_MS)

    // The .env file is read at startup and the real environment prevails over it (CONVENTIONS-TECHNIQUES, US-003 CA-19).
    // Two distinct values: the one of the .env file, valid or not, must never be mistaken for the one of the real environment.

    it('US-001/CA-1 reads JWT_SECRET from a .env file in the working directory when the real environment has none: the hub listens and announces its startup', async () => {
        const port = await freePort()
        writeFileSync(join(workDirectory, '.env'), 'JWT_SECRET=' + ENV_FILE_VALID_SECRET + '\n')
        const hub = startHub(String(port), { JWT_SECRET: undefined })

        await waitUntilListening(hub, port)
        await waitForStartupAnnouncement(hub, port)

        expect(withoutNodeWarnings(hub.errors())).not.toMatch(STARTUP_FAILURE_MARK)
    }, TEST_TIMEOUT_MS)

    it('US-001/CA-1 does not read the too short JWT_SECRET of the .env file when the real environment has a valid one: the hub listens and announces its startup', async () => {
        const port = await freePort()
        writeFileSync(join(workDirectory, '.env'), 'JWT_SECRET=' + TOO_SHORT_SECRET + '\n')
        const hub = startHub(String(port))

        await waitUntilListening(hub, port)
        await waitForStartupAnnouncement(hub, port)

        expect(withoutNodeWarnings(hub.errors())).not.toMatch(STARTUP_FAILURE_MARK)
    }, TEST_TIMEOUT_MS)

    it.each([
        ['a valid one in the .env file and a too short one in the real environment', ENV_FILE_VALID_SECRET, TOO_SHORT_SECRET],
        ['a too short one in the .env file and none in the real environment', TOO_SHORT_SECRET, undefined]
    ] as const)('US-001/CA-1 refuses to start with %s: exit code 1, the message naming JWT_SECRET and its rule without any secret, no database opened, nothing listens', async (_name, envFileSecret, realSecret) => {
        const port = await freePort()
        writeFileSync(join(workDirectory, '.env'), 'JWT_SECRET=' + envFileSecret + '\n')
        const hub = startHub(String(port), { JWT_SECRET: realSecret })

        const exit = await exitOf(hub)

        expect(exit).toEqual({ code: 1, signal: null })
        expect(hub.errors()).toMatch(/^Server starting failed: JWT_SECRET /m)
        expect(hub.errors()).toContain('32')
        expect(hub.errors()).not.toMatch(STACK_TRACE)
        expect(hub.errors()).not.toContain(TOO_SHORT_SECRET)
        expect(hub.errors()).not.toContain(ENV_FILE_VALID_SECRET)
        expect(hub.standardOutput()).toBe('')
        expect(hub.console()).not.toContain('Server started')
        expect(hub.console()).not.toContain('Listening on')
        expect(await canConnect(port)).toBe(false)
        expect(readdirSync(workDirectory)).toEqual(['.env'])
    }, TEST_TIMEOUT_MS)
})

// US-003/CA-20 on the real process. The failure goes on the error output behind the prefix of US-001 CA-7 (decision #50). The wording after
// the prefix is not normative (decision #53): the tests fix the prefix, the name of the variable and the words that carry the rule
// (an integer, strictly positive, in seconds), never the sentence. The 20 digits are the probe of DEBTS.md: no ceiling (decision #42).
describe('hub startup: JWT_EXPIRATION', () => {
    it.each(['abc', '3600s', '1.5', '1e3', '0', '-5', ' 3600'])('US-003/CA-20 refuses to start when JWT_EXPIRATION is %j: exit code 1, the message naming JWT_EXPIRATION and its rule on the error output, nothing listens', async (expiration) => {
        const port = await freePort()
        const hub = startHub(String(port), { JWT_EXPIRATION: expiration })

        const exit = await exitOf(hub)

        expect(exit).toEqual({ code: 1, signal: null })
        expect(hub.errors()).toMatch(/^Server starting failed: .*JWT_EXPIRATION/m)
        expect(hub.errors()).toMatch(/integer/i)
        expect(hub.errors()).toMatch(/positive/i)
        expect(hub.errors()).toMatch(/seconds/i)
        expect(hub.errors()).not.toMatch(STACK_TRACE)
        expect(hub.standardOutput()).not.toContain('JWT_EXPIRATION')
        expect(hub.console()).not.toContain('Server started')
        expect(hub.console()).not.toContain('Listening on')
        expect(await canConnect(port)).toBe(false)
    }, TEST_TIMEOUT_MS)

    it.each([
        ['absent', undefined],
        ['empty', ''],
        ['a 20-digit integer, with no ceiling', '9'.repeat(20)]
    ] as const)('US-003/CA-20 starts and listens when JWT_EXPIRATION is %s', async (_name, expiration) => {
        const port = await freePort()
        const hub = startHub(String(port), { JWT_EXPIRATION: expiration })

        await waitUntilListening(hub, port)

        expect(hub.errors()).not.toContain('JWT_EXPIRATION')
    }, TEST_TIMEOUT_MS)
})

// US-003/CA-21 and decision #94 on the real process. The rule is proved by read-max-requests-per-minute.test.ts; here we prove that index.ts applies it, and in the
// order of the decision (JWT_*, PORT, MAX_REQUESTS_PER_MINUTE, then the database). A value in a .env file is not covered (debt).
// Every refusal leaves the working directory empty: no database file was created, so the check came before the opening of the database.
const MAX_REQUESTS_PER_MINUTE_REFUSAL = 'Server starting failed: MAX_REQUESTS_PER_MINUTE must be an integer between 1 and 2147483647, written with digits only.'

describe('hub startup: MAX_REQUESTS_PER_MINUTE', () => {
    it.each(['', 'abc', '8080abc', '1.5', '1e3', '0', '-1', '+5', ' 5', '5 ', '  \t', '2147483648'])('US-003/CA-21 refuses to start when MAX_REQUESTS_PER_MINUTE is %j: exit code 1, the message on the error output, nothing listens, no database created', async (invalid) => {
        const port = await freePort()
        const hub = startHub(String(port), { MAX_REQUESTS_PER_MINUTE: invalid })

        const exit = await exitOf(hub)

        expect(exit).toEqual({ code: 1, signal: null })
        expect(hub.errors()).toContain(MAX_REQUESTS_PER_MINUTE_REFUSAL)
        expect(hub.errors().match(/Server starting failed:/g)).toHaveLength(1)
        expect(hub.errors()).not.toMatch(STACK_TRACE)
        expect(hub.standardOutput()).not.toContain('MAX_REQUESTS_PER_MINUTE')
        expect(hub.console()).not.toContain('Server started')
        expect(hub.console()).not.toContain('Listening on')
        expect(await canConnect(port)).toBe(false)
        expect(readdirSync(workDirectory)).toEqual([])
    }, TEST_TIMEOUT_MS)

    it.each(['abc', '8080abc', '1.5', '1e3', '-1', '+5', '2147483648'])('US-003/CA-21 does not repeat the invalid MAX_REQUESTS_PER_MINUTE %j in the console', async (invalid) => {
        const hub = startHub(String(await freePort()), { MAX_REQUESTS_PER_MINUTE: invalid })

        await exitOf(hub)

        expect(hub.console()).not.toContain(invalid)
    }, TEST_TIMEOUT_MS)

    it.each([
        ['absent', undefined],
        ['the lowest ceiling, 1', '1'],
        ['written with leading zeros', '0100'],
        ['the highest ceiling, 2147483647', '2147483647']
    ] as const)('US-003/CA-21 starts and listens when MAX_REQUESTS_PER_MINUTE is %s', async (_name, valid) => {
        const port = await freePort()
        const hub = startHub(String(port), { MAX_REQUESTS_PER_MINUTE: valid })

        await waitUntilListening(hub, port)

        expect(hub.errors()).not.toContain('MAX_REQUESTS_PER_MINUTE')
    }, TEST_TIMEOUT_MS)

    it.each([
        ['JWT_SECRET', { JWT_SECRET: 'short' }],
        ['JWT_EXPIRATION', { JWT_EXPIRATION: 'abc' }]
    ] as const)('US-003/CA-21 reports only the %s error, with exit code 1, when MAX_REQUESTS_PER_MINUTE is invalid too', async (variable, overrides) => {
        const hub = startHub(String(await freePort()), { ...overrides, MAX_REQUESTS_PER_MINUTE: 'abc' })

        const exit = await exitOf(hub)

        expect(exit).toEqual({ code: 1, signal: null })
        expect(hub.errors()).toContain(variable)
        expect(hub.errors()).not.toContain('MAX_REQUESTS_PER_MINUTE')
        expect(hub.errors().match(/Server starting failed:/g)).toHaveLength(1)
    }, TEST_TIMEOUT_MS)

    it('US-003/CA-21 reports only the PORT error, with exit code 1, when MAX_REQUESTS_PER_MINUTE is invalid too', async () => {
        const hub = startHub('abc', { MAX_REQUESTS_PER_MINUTE: 'abc' })

        const exit = await exitOf(hub)

        expect(exit).toEqual({ code: 1, signal: null })
        expect(hub.errors()).toMatch(/^Server starting failed: PORT /m)
        expect(hub.errors()).not.toContain('MAX_REQUESTS_PER_MINUTE')
        expect(hub.errors().match(/Server starting failed:/g)).toHaveLength(1)
    }, TEST_TIMEOUT_MS)

    it.each([
        ['empty', ''],
        ['a directory that does not exist', join('no-such-directory', 'hub.db')]
    ] as const)('US-003/CA-21 reports only the MAX_REQUESTS_PER_MINUTE error, with exit code 1, when SQLITE_DB_PATH is %s too', async (_name, databasePath) => {
        const hub = startHub(String(await freePort()), { MAX_REQUESTS_PER_MINUTE: 'abc', SQLITE_DB_PATH: databasePath })

        const exit = await exitOf(hub)

        expect(exit).toEqual({ code: 1, signal: null })
        expect(hub.errors()).toContain(MAX_REQUESTS_PER_MINUTE_REFUSAL)
        expect(hub.errors()).not.toContain('SQLITE_DB_PATH')
        expect(hub.errors().match(/Server starting failed:/g)).toHaveLength(1)
    }, TEST_TIMEOUT_MS)

    it('US-001/CA-10 still reports SQLITE_DB_PATH when MAX_REQUESTS_PER_MINUTE is valid', async () => {
        const hub = startHub(String(await freePort()), { MAX_REQUESTS_PER_MINUTE: '5', SQLITE_DB_PATH: '' })

        const exit = await exitOf(hub)

        expect(exit).toEqual({ code: 1, signal: null })
        expect(hub.errors()).toContain(SQLITE_DB_PATH_REFUSAL)
        expect(hub.errors()).not.toContain('MAX_REQUESTS_PER_MINUTE')
    }, TEST_TIMEOUT_MS)
})

// US-001/CA-1, US-003/CA-19 and decision #76 on the real process: `.env.example` copied to `.env` without any edit is refused by the hub,
// because JWT_SECRET has no value. The wording after the prefix is not normative (US-003 CA-19 gives an example): the tests fix the prefix,
// the name of the variable, the exit code, the empty standard output and that nothing listens. env-example.test.ts proves the content of the
// model; the test is here because it needs the helpers of the real process (the environment is explicit: no JWT_* or SEED_* variable comes from
// the machine, the model alone writes them). The control run only gives JWT_SECRET a valid value in the copy and is accepted: it proves that the
// .env file is read (any other failure would give the same exit code), and that the empty JWT_SECRET alone made the difference.
describe('hub startup: an unedited copy of .env.example', () => {
    const MODEL = readFileSync(resolve(__dirname, '../.env.example'), 'utf8')

    it('US-001/CA-1 is refused: exit code 1, the prefix and JWT_SECRET on the error output, nothing on the standard output, nothing listens', async () => {
        const port = await freePort()
        writeFileSync(join(workDirectory, '.env'), MODEL)
        const hub = startHub(String(port), { JWT_SECRET: undefined })

        const exit = await exitOf(hub)

        expect(exit).toEqual({ code: 1, signal: null })
        expect(hub.errors()).toMatch(/^Server starting failed: /m)
        expect(hub.errors()).toContain('JWT_SECRET')
        expect(hub.standardOutput()).toBe('')
        expect(await canConnect(port)).toBe(false)
    }, TEST_TIMEOUT_MS)

    it('US-001/CA-1 starts once JWT_SECRET has a valid value in the copy: the hub listens and announces its startup', async () => {
        const port = await freePort()
        writeFileSync(join(workDirectory, '.env'), MODEL.replace(/^JWT_SECRET=.*$/m, 'JWT_SECRET=' + ENV_FILE_VALID_SECRET))
        const hub = startHub(String(port), { JWT_SECRET: undefined })

        await waitUntilListening(hub, port)
        await waitForStartupAnnouncement(hub, port)

        expect(withoutNodeWarnings(hub.errors())).not.toMatch(STARTUP_FAILURE_MARK)
    }, TEST_TIMEOUT_MS)
})

describe('hub startup: unusable database', () => {
    const TEXT = 'this is a text file, not a SQLite database'

    // 200 bytes of arbitrary binary content, reproducible: a PRNG (mulberry32) with a constant seed, never crypto.randomBytes (an unstable test).
    function randomBytes(length: number): Buffer {
        let state = 0x5EED
        const bytes = Buffer.alloc(length)
        for (let i = 0; i < length; i++) {
            state = (state + 0x6D2B79F5) | 0
            let t = Math.imul(state ^ (state >>> 15), 1 | state)
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
            bytes[i] = ((t ^ (t >>> 14)) >>> 0) & 0xFF
        }
        return bytes
    }
    const RANDOM_BYTES = randomBytes(200)

    function unusableDatabase(kind: 'missing directory' | 'directory' | 'text file' | '200 random bytes'): string {
        if (kind === 'missing directory') return join(workDirectory, 'missing-directory', 'hub.db')
        if (kind === 'directory') {
            const directory = join(workDirectory, 'a-directory')
            mkdirSync(directory)
            return directory
        }
        if (kind === '200 random bytes') {
            const binaryFile = join(workDirectory, 'random.db')
            writeFileSync(binaryFile, RANDOM_BYTES)
            return binaryFile
        }
        const textFile = join(workDirectory, 'notes.db')
        writeFileSync(textFile, TEXT)
        return textFile
    }

    it('US-001/CA-9 uses 200 random bytes that are neither all zero nor the header of a SQLite database', () => {
        expect(RANDOM_BYTES).toHaveLength(200)
        expect(RANDOM_BYTES.some(byte => byte !== 0)).toBe(true)
        expect(RANDOM_BYTES.subarray(0, 16).equals(Buffer.from('SQLite format 3\0', 'latin1'))).toBe(false)
        expect(RANDOM_BYTES.includes(0)).toBe(true)
        expect(RANDOM_BYTES.some(byte => byte < 0x20 && ![0x09, 0x0A, 0x0D].includes(byte))).toBe(true)
    })

    it.each(['missing directory', 'directory', 'text file', '200 random bytes'] as const)('US-001/CA-9 refuses to start on a %s: exit code 1, the cause on the error output, nothing listens', async (kind) => {
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

    it('US-001/CA-9 leaves a file of 200 random bytes untouched, byte for byte', async () => {
        const binaryFile = unusableDatabase('200 random bytes')
        const hub = startHub(String(await freePort()), { SQLITE_DB_PATH: binaryFile })

        await exitOf(hub)

        expect(readFileSync(binaryFile).equals(RANDOM_BYTES)).toBe(true)
        expect(readdirSync(workDirectory)).toEqual(['random.db'])
    }, TEST_TIMEOUT_MS)

    it('US-001/CA-9 reports the PORT error first when the file of 200 random bytes cannot be used either', async () => {
        const hub = startHub('abc', { SQLITE_DB_PATH: unusableDatabase('200 random bytes') })

        await exitOf(hub)

        expect(hub.errors()).toContain('PORT')
        expect(hub.errors()).not.toContain('database')
    }, TEST_TIMEOUT_MS)

    it('US-001/CA-9 reports the PORT error first when the database cannot be used either', async () => {
        const hub = startHub('abc', { SQLITE_DB_PATH: join(workDirectory, 'missing-directory', 'hub.db') })

        await exitOf(hub)

        expect(hub.errors()).toContain('PORT')
        expect(hub.errors()).not.toContain('database')
    }, TEST_TIMEOUT_MS)

    it.each([
        ['absent', undefined],
        ['empty', ''],
        ['31 characters long', 'k'.repeat(31)]
    ] as const)('US-001/CA-9 reports only the JWT_SECRET error, before the database, when JWT_SECRET is %s and the file of the database is a text file', async (_name, secret) => {
        const textFile = unusableDatabase('text file')
        const hub = startHub(String(await freePort()), { SQLITE_DB_PATH: textFile, JWT_SECRET: secret })

        const exit = await exitOf(hub)

        expect(exit).toEqual({ code: 1, signal: null })
        expect(hub.errors()).toMatch(/^Server starting failed: JWT_SECRET /m)
        expect(hub.errors()).not.toContain('database')
        expect(hub.errors().match(/Server starting failed:/g)).toHaveLength(1)
        expect(readFileSync(textFile, 'utf8')).toBe(TEXT)
        expect(readdirSync(workDirectory)).toEqual(['notes.db'])
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

    // US-001 CA-9, decision #58: the file is treated as a new database, so the tables are created in it. Born green: the behaviour
    // existed before this test (until now only the CA-8 test above saw the tables of such a file). The hub is stopped
    // before the file is read, so that the tables seen are those the startup left on disk.
    it('US-001/CA-9 creates the three tables of the hub in an existing database file of zero bytes and then listens', async () => {
        const emptyFile = join(workDirectory, 'empty.db')
        writeFileSync(emptyFile, '')
        const port = await freePort()
        const hub = startHub(String(port), { SQLITE_DB_PATH: emptyFile })

        await waitUntilListening(hub, port)
        await waitForStartupAnnouncement(hub, port)
        killProcessTree(hub)
        await hub.exited

        expect(Object.keys(rowCounts(emptyFile)).sort()).toEqual(['T_QUESTION_QST', 'T_THEME_THM', 'T_USER_USR'])
        expect(hub.errors()).not.toMatch(STARTUP_FAILURE)
    }, TEST_TIMEOUT_MS)
})

// The permission tests cannot prove anything where permissions do not apply: root ignores them and Windows does not have
// the POSIX ones (the Windows behaviour was probed by hand on 2026-11-18, see decision #70, and these tests are skipped
// there for want of a written equivalent, see DEBTS.md). They are skipped, with the reason in the title
// and on the console, never silently green. A final probe covers any other machine where chmod has no effect.
function filePermissionsSkipReason(): string | undefined {
    if (process.platform === 'win32') return 'Windows: POSIX file permissions do not apply'
    if (process.getuid?.() === 0) return 'running as root: file permissions have no effect'
    const probeDirectory = mkdtempSync(join(tmpdir(), 'quiz-hub-permission-probe-'))
    try {
        const file = join(probeDirectory, 'file')
        writeFileSync(file, 'x')
        chmodSync(file, 0o000)
        let readable = true
        try { readFileSync(file) } catch { readable = false }
        if (readable) return 'a chmod 000 file can still be read: file permissions have no effect here'
        chmodSync(file, 0o644)
        const folder = join(probeDirectory, 'folder')
        mkdirSync(folder)
        chmodSync(folder, 0o555)
        let writable = true
        try { writeFileSync(join(folder, 'file'), 'x') } catch { writable = false }
        if (writable) return 'a file can still be created in a chmod 555 directory: directory permissions have no effect here'
        return undefined
    } finally {
        restorePermissions(probeDirectory)
        rmSync(probeDirectory, { recursive: true, force: true })
    }
}

// The privileged port of the CA-8 test: the probe must see this very process refused on it (EACCES), not allowed, not occupied.
const PRIVILEGED_PORT = 80

function privilegedPortSkipReason(): string | undefined {
    if (process.platform === 'win32') return 'Windows: no privileged ports'
    const script = `
        const net = require('node:net')
        const port = ${PRIVILEGED_PORT}
        const socket = net.connect({ host: '127.0.0.1', port })
        socket.once('connect', () => { console.log('occupied'); process.exit(0) })
        socket.once('error', () => {
            const server = net.createServer()
            server.once('error', error => { console.log(error.code); process.exit(0) })
            server.listen(port, '0.0.0.0', () => { console.log('allowed'); process.exit(0) })
        })`
    const probe = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8', timeout: 10_000 })
    const result = probe.stdout.trim()
    if (result === 'EACCES') return undefined
    if (result === 'allowed') return 'port ' + PRIVILEGED_PORT + ' can be opened by this account (root, or no privileged ports): no refusal to observe'
    if (result === 'occupied') return 'port ' + PRIVILEGED_PORT + ' is already occupied on this machine'
    return 'port ' + PRIVILEGED_PORT + ' gives ' + (result || 'no answer') + ' instead of EACCES'
}

const PRIVILEGED_PORT_SKIP = privilegedPortSkipReason()
const FILE_PERMISSIONS_SKIP = filePermissionsSkipReason()
if (PRIVILEGED_PORT_SKIP !== undefined) console.warn('[index.test] SKIPPED the EACCES test: ' + PRIVILEGED_PORT_SKIP)
if (FILE_PERMISSIONS_SKIP !== undefined) console.warn('[index.test] SKIPPED the file permission tests: ' + FILE_PERMISSIONS_SKIP)
const SKIPPED_EACCES = ' (skipped when the port ' + PRIVILEGED_PORT + ' cannot be refused to this account: root, Windows, occupied)'
const SKIPPED_PERMISSIONS = ' (skipped as root, on Windows, or where file permissions have no effect)'

// The hub makes its own database: run once, as `npm start` does, then stopped. The file then holds the three tables of the hub.
async function createHubDatabase(databasePath: string): Promise<void> {
    const port = await freePort()
    const hub = startHub(String(port), { SQLITE_DB_PATH: databasePath })
    await waitUntilListening(hub, port)
    await waitForStartupAnnouncement(hub, port)
    killProcessTree(hub)
    await hub.exited
}

function expectRefusedWithoutListening(hub: Hub, exit: Exit): void {
    expect(exit).toEqual({ code: 1, signal: null })
    expect(hub.errors()).toMatch(STARTUP_FAILURE)
    expect(hub.errors()).not.toMatch(STACK_TRACE)
    expect(hub.console()).not.toContain('Server started')
    expect(hub.console()).not.toContain('Listening on')
}

describe('hub startup: listen refused by the system', () => {
    it.skipIf(PRIVILEGED_PORT_SKIP !== undefined)('US-001/CA-8 refuses to start when it has no right to listen on the privileged port ' + PRIVILEGED_PORT + ': exit code 1, listen EACCES on the error output, nothing on the standard output' + SKIPPED_EACCES, async () => {
        const hub = startHub(String(PRIVILEGED_PORT))

        const exit = await exitOf(hub)

        expectRefusedWithoutListening(hub, exit)
        expect(hub.errors()).toMatch(/^Server starting failed: listen EACCES/m)
        expect(hub.standardOutput()).toBe('')
        expect(await canConnect(PRIVILEGED_PORT)).toBe(false)
    }, TEST_TIMEOUT_MS)
})

describe('hub startup: database file permissions', () => {
    const lockedDirectory = () => {
        const directory = join(workDirectory, 'locked-directory')
        mkdirSync(directory)
        return directory
    }

    it.skipIf(FILE_PERMISSIONS_SKIP !== undefined)('US-001/CA-9 refuses to start on an existing database that cannot be accessed (chmod 000): exit code 1, the cause on the error output, nothing listens, file unchanged' + SKIPPED_PERMISSIONS, async () => {
        const databasePath = join(workDirectory, 'hub.db')
        await createHubDatabase(databasePath)
        const before = readFileSync(databasePath)
        chmodSync(databasePath, 0o000)
        const port = await freePort()
        const hub = startHub(String(port), { SQLITE_DB_PATH: databasePath })

        const exit = await exitOf(hub)

        expectRefusedWithoutListening(hub, exit)
        expect(await canConnect(port)).toBe(false)
        chmodSync(databasePath, 0o644)
        expect(readFileSync(databasePath).equals(before)).toBe(true)
    }, TEST_TIMEOUT_MS)

    it.skipIf(FILE_PERMISSIONS_SKIP !== undefined)('US-001/CA-9 refuses to start on a read-only file of zero bytes, which would need its tables: exit code 1, the cause on the error output, nothing listens, file still empty' + SKIPPED_PERMISSIONS, async () => {
        const databasePath = join(workDirectory, 'empty.db')
        writeFileSync(databasePath, '')
        chmodSync(databasePath, 0o444)
        const port = await freePort()
        const hub = startHub(String(port), { SQLITE_DB_PATH: databasePath })

        const exit = await exitOf(hub)

        expectRefusedWithoutListening(hub, exit)
        expect(await canConnect(port)).toBe(false)
        expect(statSync(databasePath).size).toBe(0)
    }, TEST_TIMEOUT_MS)

    it.skipIf(FILE_PERMISSIONS_SKIP !== undefined)('US-001/CA-9 refuses to start on an absent file in a read-only directory: exit code 1, the cause on the error output, nothing listens, no file created' + SKIPPED_PERMISSIONS, async () => {
        const directory = lockedDirectory()
        chmodSync(directory, 0o555)
        const port = await freePort()
        const hub = startHub(String(port), { SQLITE_DB_PATH: join(directory, 'hub.db') })

        const exit = await exitOf(hub)

        expectRefusedWithoutListening(hub, exit)
        expect(await canConnect(port)).toBe(false)
        expect(readdirSync(directory)).toEqual([])
    }, TEST_TIMEOUT_MS)

    // Decision #69: the database already holds the three tables of the hub, so the opening writes nothing and the hub starts.
    // Made as the hub makes it, then given the eleven accounts by the seed (the write test below needs the admin).
    async function databaseWithTheThreeTables(kind: 'read-only file' | 'read-only directory'): Promise<string> {
        const directory = kind === 'read-only directory' ? lockedDirectory() : workDirectory
        const databasePath = join(directory, 'hub.db')
        await createHubDatabase(databasePath)
        seedAccounts(databasePath)
        if (kind === 'read-only file') chmodSync(databasePath, 0o444)
        else chmodSync(directory, 0o555)
        return databasePath
    }

    it.skipIf(FILE_PERMISSIONS_SKIP !== undefined).each(['read-only file', 'read-only directory'] as const)('US-001/CA-9 does not refuse a database with the three tables of the hub in a %s: it starts, listens and announces, without a startup failure' + SKIPPED_PERMISSIONS, async (kind) => {
        const databasePath = await databaseWithTheThreeTables(kind)
        const port = await freePort()
        const hub = startHub(String(port), { SQLITE_DB_PATH: databasePath })

        await waitUntilListening(hub, port)
        await waitForStartupAnnouncement(hub, port)
        await new Promise(done => setTimeout(done, 300))

        expect(hub.child.exitCode).toBeNull()
        const errors = withoutNodeWarnings(hub.errors())
        expect(errors).not.toMatch(STARTUP_FAILURE_MARK)
        expect(errors).not.toMatch(UNHANDLED_ERROR)
    }, TEST_TIMEOUT_MS)

    // Decision #69, point 3 (a finding, not a rule): reads work, a write answers the standard 500 without the technical message.
    it.skipIf(FILE_PERMISSIONS_SKIP !== undefined).each(['read-only file', 'read-only directory'] as const)('US-001/CA-9 answers a write on a %s with the standard 500 and not the SQLite message, after reads that succeed (finding of decision #69)' + SKIPPED_PERMISSIONS, async (kind) => {
        const databasePath = await databaseWithTheThreeTables(kind)
        const port = await freePort()
        const hub = startHub(String(port), { SQLITE_DB_PATH: databasePath })
        await waitUntilListening(hub, port)
        const url = (path: string) => 'http://127.0.0.1:' + port + path
        const tokenResponse = await fetch(url('/api/v1/token'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'an-admin-password-1' }) })
        const { token } = await tokenResponse.json() as { token: string }
        const authorization = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }

        const read = await fetch(url('/api/v1/themes'), { headers: authorization })
        const write = await fetch(url('/api/v1/themes'), { method: 'POST', headers: authorization, body: JSON.stringify({ name: 'Musique' }) })

        expect(tokenResponse.status).toBe(200)
        expect(read.status).toBe(200)
        expect(write.status).toBe(500)
        expect(await write.json()).toEqual({ status: 500, error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred. Please try again later.' })
        expect(hub.child.exitCode).toBeNull()
    }, TEST_TIMEOUT_MS)

    // Decision #69, point 2 and "Moment de l'erreur": a file that must still receive tables is refused. Here only T_USER_USR exists (the seed alone).
    it.skipIf(FILE_PERMISSIONS_SKIP !== undefined).each(['read-only file', 'read-only directory'] as const)('US-001/CA-9 still refuses a %s that has only the table of the seed: exit code 1, the cause on the error output, nothing listens' + SKIPPED_PERMISSIONS, async (kind) => {
        const directory = kind === 'read-only directory' ? lockedDirectory() : workDirectory
        const databasePath = join(directory, 'seed-only.db')
        seedAccounts(databasePath)
        expect(Object.keys(rowCounts(databasePath))).toEqual(['T_USER_USR'])
        if (kind === 'read-only file') chmodSync(databasePath, 0o444)
        else chmodSync(directory, 0o555)
        const port = await freePort()
        const hub = startHub(String(port), { SQLITE_DB_PATH: databasePath })

        const exit = await exitOf(hub)

        expectRefusedWithoutListening(hub, exit)
        expect(await canConnect(port)).toBe(false)
        expect(Object.keys(rowCounts(databasePath))).toEqual(['T_USER_USR'])
    }, TEST_TIMEOUT_MS)
})

// US-003/CA-4 on the real process: the token that a real `POST /api/v1/token` returns lives `exp - iat` seconds, 3600 by default and
// the value of JWT_EXPIRATION otherwise, read from the real environment or, when it has none, from a .env file of the working directory
// (the real environment prevails, see the JWT_SECRET tests above). An empty JWT_EXPIRATION, in the real environment or on a .env line, is the default (CA-20). The rule on the value is proved by jwt-settings.test.ts and the
// refusal of an invalid one by the JWT_EXPIRATION tests above; here we prove that index.ts wires the setting to the token it emits.
// The payload is read without verifying the signature (CA-2) nor the other claims (CA-3): only `iat` and `exp` matter here.
describe('hub token lifetime (JWT_EXPIRATION)', () => {
    const ADMIN = { username: 'admin', password: 'an-admin-password-1' }

    function jwtPayload(token: string): { iat: number, exp: number } {
        const [, payload] = token.split('.')
        if (token.split('.').length !== 3 || payload === undefined) throw new Error('Not a JWT: ' + token)
        return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { iat: number, exp: number }
    }

    // A real token of a real hub: seeded database, then `POST /api/v1/token` with the admin account of the seed.
    async function tokenLifetime(overrides: Record<string, string | undefined>): Promise<{ lifetime: number, expiresIn: number }> {
        const databasePath = join(workDirectory, 'hub.db')
        seedAccounts(databasePath)
        const port = await freePort()
        const hub = startHub(String(port), { SQLITE_DB_PATH: databasePath, ...overrides })
        await waitUntilListening(hub, port)

        const response = await fetch('http://127.0.0.1:' + port + '/api/v1/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ADMIN) })

        expect(response.status).toBe(200)
        const body = await response.json() as { token: string, expires_in: number }
        const { iat, exp } = jwtPayload(body.token)
        return { lifetime: exp - iat, expiresIn: body.expires_in }
    }

    it('US-003/CA-4 gives the token a lifetime of 3600 seconds when JWT_EXPIRATION is absent from the environment and from any .env file', async () => {
        const { lifetime, expiresIn } = await tokenLifetime({ JWT_EXPIRATION: undefined })

        expect(lifetime).toBe(3600)
        expect(expiresIn).toBe(3600)
    }, TEST_TIMEOUT_MS)

    it('US-003/CA-4 gives the token a lifetime of 7200 seconds when JWT_EXPIRATION is 7200 in the real environment', async () => {
        const { lifetime, expiresIn } = await tokenLifetime({ JWT_EXPIRATION: '7200' })

        expect(lifetime).toBe(7200)
        expect(expiresIn).toBe(7200)
    }, TEST_TIMEOUT_MS)

    it('US-003/CA-4 gives the token the lifetime written in the .env file of the working directory when the real environment has no JWT_EXPIRATION', async () => {
        writeFileSync(join(workDirectory, '.env'), 'JWT_EXPIRATION=5400\n')

        const { lifetime, expiresIn } = await tokenLifetime({ JWT_EXPIRATION: undefined })

        expect(lifetime).toBe(5400)
        expect(expiresIn).toBe(5400)
    }, TEST_TIMEOUT_MS)

    // Two distinct valid values: the one of the .env file must never be mistaken for the one of the real environment.
    it('US-003/CA-4 gives the token the lifetime of the real environment when the .env file of the working directory writes another valid JWT_EXPIRATION', async () => {
        writeFileSync(join(workDirectory, '.env'), 'JWT_EXPIRATION=5400\n')

        const { lifetime, expiresIn } = await tokenLifetime({ JWT_EXPIRATION: '7200' })

        expect(lifetime).toBe(7200)
        expect(expiresIn).toBe(7200)
    }, TEST_TIMEOUT_MS)

    // CA-20: "Absente ou vide, la variable vaut 3600". Spec tests (born green, the code already conforms): an empty value is not a written value,
    // so it must not be refused as an invalid duration (the startup tests above only prove that the hub listens) and must give the default.
    it('US-003/CA-20 gives the token a lifetime of 3600 seconds when JWT_EXPIRATION is an empty string in the real environment', async () => {
        const { lifetime, expiresIn } = await tokenLifetime({ JWT_EXPIRATION: '' })

        expect(lifetime).toBe(3600)
        expect(expiresIn).toBe(3600)
    }, TEST_TIMEOUT_MS)

    it('US-003/CA-20 gives the token a lifetime of 3600 seconds when the .env file of the working directory has an empty JWT_EXPIRATION line and the real environment has none', async () => {
        writeFileSync(join(workDirectory, '.env'), 'JWT_EXPIRATION=\n')

        const { lifetime, expiresIn } = await tokenLifetime({ JWT_EXPIRATION: undefined })

        expect(lifetime).toBe(3600)
        expect(expiresIn).toBe(3600)
    }, TEST_TIMEOUT_MS)
})

// US-003/CA-1 and CA-2 on the real process: a real `POST /api/v1/token` answers the type of the token ("Bearer") and a token that is
// signed with HS256 and with the JWT_SECRET of the environment of the hub, which no other secret verifies. The secret differs from the
// default of startHub, so that a generator wired to another secret (the default one included) cannot pass. The claims (CA-3) and the
// lifetime (CA-4) are proved elsewhere; the rule of the signature by jwt-generator.test.ts, which does not see how index.ts wires the secret.
describe('hub token (token_type and JWT_SECRET)', () => {
    const ADMIN = { username: 'admin', password: 'an-admin-password-1' }
    const TOKEN_SECRET = 'a-secret-that-signs-the-tokens-0123456789'

    async function realTokenResponse(): Promise<{ token: string, token_type: string }> {
        const databasePath = join(workDirectory, 'hub.db')
        seedAccounts(databasePath)
        const port = await freePort()
        const hub = startHub(String(port), { SQLITE_DB_PATH: databasePath, JWT_SECRET: TOKEN_SECRET })
        await waitUntilListening(hub, port)

        const response = await fetch('http://127.0.0.1:' + port + '/api/v1/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ADMIN) })

        expect(response.status).toBe(200)
        return await response.json() as { token: string, token_type: string }
    }

    it('US-003/CA-1 answers token_type "Bearer" to a POST /api/v1/token with the admin account of the seed', async () => {
        const body = await realTokenResponse()

        expect(body.token_type).toBe('Bearer')
    }, TEST_TIMEOUT_MS)

    it('US-003/CA-2 signs the token with HS256 and the JWT_SECRET of the environment of the hub: it verifies with that secret only', async () => {
        const { token } = await realTokenResponse()

        expect(jwt.decode(token, { complete: true })?.header.alg).toBe('HS256')
        expect(() => jwt.verify(token, TOKEN_SECRET, { algorithms: ['HS256'] })).not.toThrow()
        expect(() => jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] })).toThrow('invalid signature')
    }, TEST_TIMEOUT_MS)
})

// US-003/CA-13 on the real process: the real hub lets the limit of requests of a minute through `POST /api/v1/token` from one
// address and refuses the next one with the standard 429. The rule and the standard body are proved by token-route.test.ts and
// rate-limit-middleware.test.ts with a low limit injected; here we prove that index.ts wires the limit of the environment of
// the hub (ProcessEnvironment) to the token route: 100 by default, the value of MAX_REQUESTS_PER_MINUTE when it is written in
// the environment of the process. The content of the answers under the limit is not asserted, only the absence of 429.
// Out of scope: an invalid value (empty, 0, not a number: the CDC is silent), a value written in a .env file, trustProxy.
describe('hub token rate limit (MAX_REQUESTS_PER_MINUTE)', () => {
    async function startTokenHub(overrides: Record<string, string | undefined>): Promise<() => Promise<Response>> {
        const databasePath = join(workDirectory, 'hub.db')
        seedAccounts(databasePath)
        const port = await freePort()
        const hub = startHub(String(port), { SQLITE_DB_PATH: databasePath, ...overrides })
        await waitUntilListening(hub, port)
        return () => fetch('http://127.0.0.1:' + port + '/api/v1/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'an-admin-password-1' }) })
    }

    async function expectRefusedAfter(limit: number, requestToken: () => Promise<Response>): Promise<void> {
        const statusCodes: number[] = []
        for (let i = 0; i < limit; i++) statusCodes.push((await requestToken()).status)
        const refused = await requestToken()

        expect(statusCodes).toHaveLength(limit)
        expect(statusCodes).not.toContain(429)
        expect(refused.status).toBe(429)
        expect(refused.headers.get('retry-after')).toBe('60')
        expect(await refused.json()).toEqual({ status: 429, error: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please retry in 60 seconds.' })
    }

    it('US-003/CA-13 answers the 101st POST /api/v1/token of a minute from the same address with 429 RATE_LIMIT_EXCEEDED and Retry-After 60 when MAX_REQUESTS_PER_MINUTE is absent', async () => {
        await expectRefusedAfter(100, await startTokenHub({ MAX_REQUESTS_PER_MINUTE: undefined }))
    }, TEST_TIMEOUT_MS)

    it('US-003/CA-13 answers the 4th POST /api/v1/token of a minute from the same address with 429 RATE_LIMIT_EXCEEDED and Retry-After 60 when MAX_REQUESTS_PER_MINUTE is 3 in the real environment', async () => {
        await expectRefusedAfter(3, await startTokenHub({ MAX_REQUESTS_PER_MINUTE: '3' }))
    }, TEST_TIMEOUT_MS)
})
