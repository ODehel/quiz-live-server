import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// `npm run seed` runs `tsx src/seed.ts`: these tests run the same entry point in a child process
// and observe it from outside (exit code, outputs, files). The rules on the path are proved by
// read-database-path.test.ts; here we prove that seed.ts applies them, in the order of US-002.
const TSX_CLI = resolve(__dirname, '../node_modules/tsx/dist/cli.mjs')
const SEED = resolve(__dirname, 'seed.ts')
const TEST_TIMEOUT_MS = 30_000
const REFUSAL = 'User seeding failed: SQLITE_DB_PATH cannot be empty or made only of whitespace.'
const FAILURE = /^User seeding failed: \S/
const STACK_TRACE = /\n\s+at /
const TEXT = 'this is a text file, not a SQLite database'

let workDirectory: string

beforeEach(() => {
    workDirectory = mkdtempSync(join(tmpdir(), 'quiz-seed-'))
})

afterEach(() => {
    rmSync(workDirectory, { recursive: true, force: true, maxRetries: 5 })
})

// The environment is explicit, so that the result depends neither on a .env nor on the machine.
// The working directory is the temporary one, so that no .env of the repository is read either.
function validEnvironment(): Record<string, string> {
    const environment: Record<string, string> = { SEED_PASSWORD_ADMIN: 'an-admin-password-1', BCRYPT_COST: '4' }
    for (let i = 1; i <= 10; i++) {
        environment[`SEED_PASSWORD_BUZZER_${String(i).padStart(2, '0')}`] = `a-buzzer-password-${i}`
    }
    return environment
}

function seed(databasePath: string, overrides: Record<string, string> = {}) {
    const result = spawnSync(process.execPath, [TSX_CLI, SEED], {
        cwd: workDirectory,
        env: { ...validEnvironment(), SQLITE_DB_PATH: databasePath, ...overrides },
        encoding: 'utf8',
        timeout: TEST_TIMEOUT_MS
    })
    return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

function countAccounts(databasePath: string): number {
    const database = new Database(databasePath, { readonly: true })
    try {
        return (database.prepare('SELECT COUNT(*) AS count FROM T_USER_USR').get() as { count: number }).count
    } finally {
        database.close()
    }
}

describe('seed: SQLITE_DB_PATH', () => {
    it.each(['', ' ', '   ', '\t', '\n', '\r', ' \t\r\n', '\u00A0', '\u3000', '\uFEFF'])('US-002/CA-8 refuses to run when SQLITE_DB_PATH is %j: exit code 1, the message on the error output, nothing created', (blankPath) => {
        const result = seed(blankPath)

        expect(result.status).toBe(1)
        expect(result.stderr).toContain(REFUSAL)
        expect(result.stdout).toBe('')
        expect(readdirSync(workDirectory)).toEqual([])
    }, TEST_TIMEOUT_MS)

    it('US-002/CA-8 does not repeat the blank value in the message', () => {
        const result = seed('\t\t\t')

        expect(result.stderr).not.toContain('\t')
    }, TEST_TIMEOUT_MS)

    it('US-002/CA-8 reports only the SQLITE_DB_PATH error when a password and BCRYPT_COST are wrong too', () => {
        const result = seed(' ', { SEED_PASSWORD_ADMIN: 'short', BCRYPT_COST: 'abc' })

        expect(result.status).toBe(1)
        expect(result.stderr).toContain(REFUSAL)
        expect(result.stderr).not.toContain('Invalid password')
        expect(result.stderr).not.toContain('BCRYPT_COST')
        expect(readdirSync(workDirectory)).toEqual([])
    }, TEST_TIMEOUT_MS)

    it('US-002/CA-8 does not refuse :memory:, bordered or not: exit code 0, empty outputs, no file created', () => {
        const result = seed(' :memory: ')

        expect(result).toEqual({ status: 0, stdout: '', stderr: '' })
        expect(readdirSync(workDirectory)).toEqual([])
    }, TEST_TIMEOUT_MS)

    it('US-002/CA-8 uses the path without the whitespace around it', () => {
        const databasePath = join(workDirectory, 'bordered.db')

        const result = seed('\t\u3000' + databasePath + '\uFEFF \r\n')

        expect(result).toEqual({ status: 0, stdout: '', stderr: '' })
        expect(readdirSync(workDirectory)).toEqual(['bordered.db'])
        expect(countAccounts(databasePath)).toBe(11)
    }, TEST_TIMEOUT_MS)
})

describe('seed: unusable database', () => {
    function unusableDatabase(kind: 'missing directory' | 'directory' | 'text file'): string {
        if (kind === 'missing directory') return join(workDirectory, 'missing-directory', 'seed.db')
        if (kind === 'directory') {
            const directory = join(workDirectory, 'a-directory')
            mkdirSync(directory)
            return directory
        }
        const textFile = join(workDirectory, 'notes.db')
        writeFileSync(textFile, TEXT)
        return textFile
    }

    it.each(['missing directory', 'directory', 'text file'] as const)('US-002/CA-9 refuses to run on a %s: exit code 1, the cause on the error output, no stack trace', (kind) => {
        const result = seed(unusableDatabase(kind))

        expect(result.status).toBe(1)
        expect(result.stderr).toMatch(FAILURE)
        expect(result.stderr).not.toMatch(STACK_TRACE)
        expect(result.stdout).toBe('')
    }, TEST_TIMEOUT_MS)

    it.each(['missing directory', 'directory', 'text file'] as const)('US-002/CA-9 reports only the database error on a %s when a password and BCRYPT_COST are wrong too', (kind) => {
        const result = seed(unusableDatabase(kind), { SEED_PASSWORD_ADMIN: 'short', BCRYPT_COST: 'abc' })

        expect(result.status).toBe(1)
        expect(result.stderr).toMatch(FAILURE)
        expect(result.stderr).not.toContain('Invalid password')
        expect(result.stderr).not.toContain('BCRYPT_COST')
    }, TEST_TIMEOUT_MS)

    it('US-002/CA-9 leaves a file that is not a SQLite database untouched', () => {
        const textFile = unusableDatabase('text file')

        seed(textFile)

        expect(readFileSync(textFile, 'utf8')).toBe(TEXT)
    }, TEST_TIMEOUT_MS)

    it('US-002/CA-9 still seeds a database file that does not exist yet, in an existing directory', () => {
        const databasePath = join(workDirectory, 'new.db')

        const result = seed(databasePath)

        expect(result).toEqual({ status: 0, stdout: '', stderr: '' })
        expect(countAccounts(databasePath)).toBe(11)
    }, TEST_TIMEOUT_MS)

    it('US-002/CA-9 still seeds an existing database file of zero bytes', () => {
        const emptyFile = join(workDirectory, 'empty.db')
        writeFileSync(emptyFile, '')

        const result = seed(emptyFile)

        expect(result).toEqual({ status: 0, stdout: '', stderr: '' })
        expect(countAccounts(emptyFile)).toBe(11)
    }, TEST_TIMEOUT_MS)
})
