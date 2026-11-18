import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import Database from 'better-sqlite3'
import { connect, createServer } from 'node:net'
import { networkInterfaces, tmpdir } from 'node:os'
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
