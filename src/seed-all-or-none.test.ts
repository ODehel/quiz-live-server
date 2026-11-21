import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import bcrypt from 'bcryptjs'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// US-002/CA-3 (all or nothing, abrupt stop included) and CA-7 (the run that loses a race), decisions #66, #77 and #78, on REAL processes:
// `tsx src/seed.ts`, an explicit environment, a throw-away SQLite file, as in seed.test.ts. These are spec tests: the code already holds the guarantees
// (fix(seed) #174), so each test was born green and was proved by mutating the production code (see the handoff of the session), never by a red.
// A preloaded module (src/test-support/seed-probe.mjs, `--import`) makes the race real and picks the point where a process is killed. Nothing waits on
// a clock to see a result: the processes wait for each other through marker files, the tests wait for the exit of the processes.
//
// Not asserted, on purpose (gaps of the specification, kept in DEBTS.md):
// - T1: the wording of the line of the loser, and its equality with the line of a second launch. Only its sense is asserted: one line on the standard
//   output, no account created, exit code 0, nothing on the error output (decision #66: only the sense is normative).
// - T10: whether the table exists after a stop before any account. A missing table counts as zero account here, without being asserted.
const TSX_CLI = resolve(__dirname, '../node_modules/tsx/dist/cli.mjs')
const SEED = resolve(__dirname, 'seed.ts')
const PROBE = pathToFileURL(resolve(__dirname, 'test-support/seed-probe.mjs')).href
const TEST_TIMEOUT_MS = 60_000
const PROCESS_TIMEOUT_MS = 45_000
// Node 26 prints the DEP0205 deprecation warning of tsx on the error output: silenced by its code, so that the error output of a successful run can be required to be empty.
const SILENCE_TSX_DEPRECATION = '--disable-warning=DEP0205'
const FAILURE = /^User seeding failed: \S/
const BUZZER_VARIABLES = Array.from({ length: 10 }, (_, i) => String(i + 1).padStart(2, '0'))

let workDirectory: string
let databasePath: string
let probeDirectory: string

beforeEach(() => {
    workDirectory = mkdtempSync(join(tmpdir(), 'quiz-seed-all-or-none-'))
    databasePath = join(workDirectory, 'seed.db')
    probeDirectory = join(workDirectory, 'probe')
    mkdirSync(probeDirectory)
})

afterEach(() => {
    rmSync(workDirectory, { recursive: true, force: true, maxRetries: 5 })
})

// Eleven valid passwords, all starting with the same word: the word tells which launch wrote an account (a hash is compared with the passwords of each launch).
const adminPassword = (word: string): string => `${word}-admin-password-1`
const buzzerPassword = (word: string, number: string): string => `${word}-buzzer-password-${number}`
function environment(word: string, probe: Record<string, string>): Record<string, string> {
    const variables: Record<string, string> = { SEED_PASSWORD_ADMIN: adminPassword(word), BCRYPT_COST: '4', SQLITE_DB_PATH: databasePath }
    for (const number of BUZZER_VARIABLES) variables[`SEED_PASSWORD_BUZZER_${number}`] = buzzerPassword(word, number)
    const nodeOptions = Object.keys(probe).length === 0 ? SILENCE_TSX_DEPRECATION : `${SILENCE_TSX_DEPRECATION} --import=${PROBE}`
    return { ...variables, NODE_OPTIONS: nodeOptions, SEED_PROBE_DIR: probeDirectory, ...probe }
}

interface Outcome { status: number | null; stdout: string; stderr: string }

function seedAsync(env: Record<string, string>): Promise<Outcome> {
    return new Promise((done, fail) => {
        const child = spawn(process.execPath, [TSX_CLI, SEED], { cwd: workDirectory, env, stdio: ['ignore', 'pipe', 'pipe'] })
        let stdout = ''
        let stderr = ''
        child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk })
        child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk })
        // A safety net against a hung child, not a wait: it never fires when the processes exit.
        const guard = setTimeout(() => child.kill('SIGKILL'), PROCESS_TIMEOUT_MS)
        child.on('error', fail)
        child.on('close', (status) => { clearTimeout(guard); done({ status, stdout, stderr }) })
    })
}

function seedSync(env: Record<string, string>): Outcome {
    const result = spawnSync(process.execPath, [TSX_CLI, SEED], { cwd: workDirectory, env, encoding: 'utf8', timeout: PROCESS_TIMEOUT_MS })
    return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

// The form shared by the line of a launch that creates the accounts (CA-1) and the line of one that does not (CA-7): exit code 0, nothing on the error output,
// exactly one non-empty line on the standard output, not a failure message. Its wording is never asserted.
function expectOneLineAndExitZero(outcome: Outcome): string {
    expect(outcome.status).toBe(0)
    expect(outcome.stderr).toBe('')
    const lines = outcome.stdout.split('\n').filter(line => line.trim() !== '')
    expect(lines).toHaveLength(1)
    expect(lines.join('')).not.toMatch(FAILURE)
    return lines.join('')
}

interface Account { login: string; hash: string }

// A read-write connection on purpose: after a SIGKILL the journal of the killed transaction is hot, and only a connection that may write rolls it back (as the next seed does).
function accountsOf(path: string): Account[] {
    const database = new Database(path, { fileMustExist: true })
    try {
        // T10 (not asserted): a stop before any account may leave no table at all. A missing table counts as zero account, the test does not say that it must exist.
        const table = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'T_USER_USR'").get()
        if (table === undefined) return []
        return database.prepare('SELECT USR_LOGIN AS login, USR_HASH_PASSWORD AS hash FROM T_USER_USR ORDER BY USR_LOGIN').all() as Account[]
    } finally {
        database.close()
    }
}

function passwordOf(word: string, login: string): string {
    return login === 'admin' ? adminPassword(word) : buzzerPassword(word, login.slice('quiz_buzzer_'.length))
}
const writtenBy = (word: string, accounts: Account[]): boolean => accounts.every(account => bcrypt.compareSync(passwordOf(word, account.login), account.hash))

const ELEVEN_LOGINS = ['admin', ...BUZZER_VARIABLES.map(number => `quiz_buzzer_${number}`)].sort()

describe('seed: two real processes race on an empty table (US-002/CA-7, decisions #77 and #78)', () => {
    it('US-002/CA-7 spec test: one launch creates the eleven accounts, the other one, which loses the race, changes nothing, prints one line, exits with code 0 and an empty error output', async () => {
        // The two launches have different passwords: the hashes tell which one wrote. Each one meets the other after reading the empty table and inside its write transaction (seed-probe.mjs).
        const [first, second] = await Promise.all([
            seedAsync(environment('alpha', { SEED_PROBE_NAME: 'first', SEED_PROBE_PEER: 'second' })),
            seedAsync(environment('bravo', { SEED_PROBE_NAME: 'second', SEED_PROBE_PEER: 'first' }))
        ])

        // Neither exits with code 1, nor with a unique-constraint message or a locked database: both exit with code 0 and an empty error output.
        const firstLine = expectOneLineAndExitZero(first)
        const secondLine = expectOneLineAndExitZero(second)
        // The probe proves that the race was real: both launches announced that they had seen the empty table, and both began a write transaction.
        for (const marker of ['first.checked', 'second.checked', 'first.begun', 'second.begun']) expect(existsSync(join(probeDirectory, marker))).toBe(true)
        // Exactly eleven accounts, all from the same launch (same passwords): one creator, one loser that wrote nothing.
        const accounts = accountsOf(databasePath)
        expect(accounts.map(account => account.login)).toEqual(ELEVEN_LOGINS)
        const byFirst = writtenBy('alpha', accounts)
        const bySecond = writtenBy('bravo', accounts)
        expect(byFirst !== bySecond).toBe(true)
        // The loser does not say what the winner says (CA-1 against CA-7: only that they differ, never a word of either).
        expect(firstLine).not.toBe(secondLine)
    }, TEST_TIMEOUT_MS)
})

// Points where the process is killed: after the N-th INSERT (before the COMMIT), then right after the COMMIT.
const KILL_POINTS = ['insert:1', 'insert:2', 'insert:5', 'insert:10', 'insert:11', 'commit'] as const

describe('seed: a process killed with SIGKILL leaves no partial account (US-002/CA-3, decision #77)', () => {
    it.each(KILL_POINTS)('US-002/CA-3 spec test: killed right after %s, the table holds zero or eleven accounts, never a part; the next launch exits with code 0 and ends with eleven accounts', (point) => {
        const killed = seedSync(environment('kill', { SEED_PROBE_KILL_AT: point }))

        // The point was reached (the marker is written just before the kill), the process did not end normally, and it printed nothing: it never reached its last line.
        expect(existsSync(join(probeDirectory, 'killed-at-' + point.replace(':', '-')))).toBe(true)
        expect(killed.status).not.toBe(0)
        expect(killed.stdout).toBe('')
        const left = accountsOf(databasePath)
        expect([0, 11]).toContain(left.length)

        // The next launch (other passwords, no probe): zero account then eleven created by it; eleven accounts then eleven accounts unchanged.
        const next = seedSync(environment('next', {}))

        expectOneLineAndExitZero(next)
        const final = accountsOf(databasePath)
        expect(final.map(account => account.login)).toEqual(ELEVEN_LOGINS)
        if (left.length === 0) expect(writtenBy('next', final)).toBe(true)
        else expect(final).toEqual(left)
    }, TEST_TIMEOUT_MS)
})
