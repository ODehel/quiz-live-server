import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { SqliteUserRepository } from './users/sqlite-user-repository'
import { UserRole } from './users/user-role'
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
// Node 26 prints the DEP0205 deprecation warning of tsx (module.register()) on the error output: it is silenced by its code,
// so that the outputs of a successful seed can still be required to be empty, whatever the version of Node.
const SILENCE_TSX_DEPRECATION = '--disable-warning=DEP0205'

function validEnvironment(): Record<string, string> {
    const environment: Record<string, string> = { SEED_PASSWORD_ADMIN: 'an-admin-password-1', BCRYPT_COST: '4' }
    for (let i = 1; i <= 10; i++) {
        environment[`SEED_PASSWORD_BUZZER_${String(i).padStart(2, '0')}`] = `a-buzzer-password-${i}`
    }
    return environment
}

// An override set to undefined removes the variable from the environment of the child process.
function seed(databasePath: string, overrides: Record<string, string | undefined> = {}) {
    const result = spawnSync(process.execPath, [TSX_CLI, SEED], {
        cwd: workDirectory,
        env: { ...validEnvironment(), NODE_OPTIONS: SILENCE_TSX_DEPRECATION, SQLITE_DB_PATH: databasePath, ...overrides },
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

describe('seed: SQLITE_DB_PATH', () => {
    it.each(BLANK_PATHS)('US-002/CA-8 refuses to run when SQLITE_DB_PATH is %s: exit code 1, the message on the error output, nothing created', (_name, blankPath) => {
        const result = seed(blankPath)

        expect(result.status).toBe(1)
        expect(result.stderr).toContain(REFUSAL)
        expect(result.stdout).toBe('')
        expect(readdirSync(workDirectory)).toEqual([])
    }, TEST_TIMEOUT_MS)

    it.each(NOT_BLANK_CHARACTERS)('US-002/CA-8 does not refuse %s alone: exit code 0, empty outputs, a file named by this one character holds the accounts', (_name, character) => {
        const result = seed(character)

        expect(result).toEqual({ status: 0, stdout: '', stderr: '' })
        expect(readdirSync(workDirectory)).toEqual([character])
        expect(countAccounts(join(workDirectory, character))).toBe(11)
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
        if (kind === 'missing directory') return join(workDirectory, 'missing-directory', 'seed.db')
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

    it('US-002/CA-9 uses 200 random bytes that are neither all zero nor the header of a SQLite database', () => {
        expect(RANDOM_BYTES).toHaveLength(200)
        expect(RANDOM_BYTES.some(byte => byte !== 0)).toBe(true)
        expect(RANDOM_BYTES.subarray(0, 16).equals(Buffer.from('SQLite format 3\0', 'latin1'))).toBe(false)
        expect(RANDOM_BYTES.includes(0)).toBe(true)
        expect(RANDOM_BYTES.some(byte => byte < 0x20 && ![0x09, 0x0A, 0x0D].includes(byte))).toBe(true)
    })

    it.each(['missing directory', 'directory', 'text file', '200 random bytes'] as const)('US-002/CA-9 refuses to run on a %s: exit code 1, the cause on the error output, no stack trace', (kind) => {
        const result = seed(unusableDatabase(kind))

        expect(result.status).toBe(1)
        expect(result.stderr).toMatch(FAILURE)
        expect(result.stderr).not.toMatch(STACK_TRACE)
        expect(result.stdout).toBe('')
    }, TEST_TIMEOUT_MS)

    it.each(['missing directory', 'directory', 'text file', '200 random bytes'] as const)('US-002/CA-9 reports only the database error on a %s when a password and BCRYPT_COST are wrong too', (kind) => {
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

    it('US-002/CA-9 leaves a file of 200 random bytes untouched, byte for byte', () => {
        const binaryFile = unusableDatabase('200 random bytes')

        seed(binaryFile)

        expect(readFileSync(binaryFile).equals(RANDOM_BYTES)).toBe(true)
        expect(readdirSync(workDirectory)).toEqual(['random.db'])
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

describe('seed: database file left behind by a refusal', () => {
    const REFUSALS = [
        ['a password that is too short', { SEED_PASSWORD_ADMIN: 'short' }],
        ['a BCRYPT_COST that is invalid', { BCRYPT_COST: 'abc' }]
    ] as const
    const STARTS = ['absent', 'zero bytes'] as const

    function databaseFile(start: typeof STARTS[number]): string {
        const databasePath = join(workDirectory, 'left.db')
        if (start === 'zero bytes') writeFileSync(databasePath, '')
        return databasePath
    }

    describe.each(REFUSALS)('with %s', (_label, overrides) => {
        it.each(STARTS)('US-002/CA-9 keeps the database file, with an empty user table, when it was %s', (start) => {
            const databasePath = databaseFile(start)

            const result = seed(databasePath, overrides)

            expect(result.status).toBe(1)
            expect(result.stderr).toMatch(FAILURE)
            expect(rowCounts(databasePath)).toEqual({ T_USER_USR: 0 })
        }, TEST_TIMEOUT_MS)

        it('US-002/CA-9 does not touch a database that already exists and has an empty user table', () => {
            const databasePath = databaseFile('absent')
            seed(databasePath, overrides)
            const before = readFileSync(databasePath)

            const result = seed(databasePath, overrides)

            expect(result.status).toBe(1)
            expect(readFileSync(databasePath).equals(before)).toBe(true)
        }, TEST_TIMEOUT_MS)

        it('US-002/CA-1 creates the eleven accounts on the next run, once the cause is corrected', () => {
            const databasePath = databaseFile('absent')
            seed(databasePath, overrides)

            const result = seed(databasePath)

            expect(result).toEqual({ status: 0, stdout: '', stderr: '' })
            expect(countAccounts(databasePath)).toBe(11)
        }, TEST_TIMEOUT_MS)
    })
})

// Every account of a database file, with its stored hash, in a stable order.
function accounts(databasePath: string): Array<{ id: string; login: string; hash: string; role: string }> {
    const database = new Database(databasePath, { readonly: true })
    try {
        return database.prepare('SELECT USR_ID AS id, USR_LOGIN AS login, USR_HASH_PASSWORD AS hash, USR_ROLE AS role FROM T_USER_USR ORDER BY USR_LOGIN').all() as Array<{ id: string; login: string; hash: string; role: string }>
    } finally {
        database.close()
    }
}

const sha256 = (path: string): string => createHash('sha256').update(readFileSync(path)).digest('hex')

describe('seed: a table that already holds accounts', () => {
    // US-002/CA-7 and decision #66: only the sense of the line is normative (no account created, because the table is not empty);
    // its wording is not. So the tests fix the form (exactly one non-empty line, on the standard output, nothing on the error output,
    // exit code 0), that it is neither the silence of a first run nor a failure message, and that it is the same line whatever
    // the environment (one condition produces it). They never fix a word of it, nor the name of the table.
    function expectSkippedSeed(result: { status: number | null; stdout: string; stderr: string }): string {
        expect(result.status).toBe(0)
        expect(result.stderr).toBe('')
        const lines = result.stdout.split('\n').filter(line => line.trim() !== '')
        expect(lines).toHaveLength(1)
        expect(result.stdout).toBe(lines.join('') + '\n')
        expect(lines.join('')).not.toMatch(FAILURE)
        return lines.join('')
    }

    function seededDatabase(): string {
        const databasePath = join(workDirectory, 'seeded.db')
        // Precondition, proved elsewhere (US-002/CA-1, CA-9): the first run on a new database is silent and creates the eleven accounts.
        expect(seed(databasePath)).toEqual({ status: 0, stdout: '', stderr: '' })
        expect(accounts(databasePath)).toHaveLength(11)
        return databasePath
    }

    it('US-002/CA-7 says that no account was created and changes nothing on a second run with the same environment', () => {
        const databasePath = seededDatabase()
        const accountsBefore = accounts(databasePath)
        const fileBefore = sha256(databasePath)

        const result = seed(databasePath)

        expectSkippedSeed(result)
        expect(accounts(databasePath)).toEqual(accountsBefore)
        expect(sha256(databasePath)).toBe(fileBefore)
    }, TEST_TIMEOUT_MS)

    it('US-002/CA-3 keeps the eleven hashes of the first run when the second run has other valid passwords and another BCRYPT_COST', () => {
        const databasePath = seededDatabase()
        const accountsBefore = accounts(databasePath)
        const otherPasswords: Record<string, string> = { BCRYPT_COST: '5', SEED_PASSWORD_ADMIN: 'another-admin-password' }
        for (let i = 1; i <= 10; i++) {
            otherPasswords[`SEED_PASSWORD_BUZZER_${String(i).padStart(2, '0')}`] = `another-buzzer-password-${i}`
        }

        const result = seed(databasePath, otherPasswords)

        expectSkippedSeed(result)
        expect(accountsBefore.every(account => account.hash.startsWith('$2b$04$'))).toBe(true)
        expect(accounts(databasePath)).toEqual(accountsBefore)
    }, TEST_TIMEOUT_MS)

    const FAULTS: Array<[string, Record<string, string | undefined>]> = [
        ['a password that is too short', { SEED_PASSWORD_ADMIN: 'short' }],
        ['an empty password', { SEED_PASSWORD_BUZZER_03: '' }],
        ['a password that is absent', { SEED_PASSWORD_BUZZER_03: undefined }],
        ['a BCRYPT_COST that is invalid', { BCRYPT_COST: 'abc' }],
        ['a password that is too short and a BCRYPT_COST that is invalid', { SEED_PASSWORD_ADMIN: 'short', BCRYPT_COST: 'abc' }]
    ]

    it.each(FAULTS)('US-002/CA-7 comes before the passwords (CA-4) and BCRYPT_COST (CA-6): with %s, the same line, exit code 0, nothing on the error output, nothing changed', (_label, overrides) => {
        const databasePath = seededDatabase()
        const accountsBefore = accounts(databasePath)
        const reference = expectSkippedSeed(seed(databasePath))

        const result = seed(databasePath, overrides)

        expect(expectSkippedSeed(result)).toBe(reference)
        expect(accounts(databasePath)).toEqual(accountsBefore)
    }, TEST_TIMEOUT_MS)

    describe('with a table that holds a single account', () => {
        const STORED = { id: '0192f0f0-0000-7000-8000-000000000001', username: 'quiz_buzzer_07', password: 'a-hash-that-no-run-may-rewrite', role: UserRole.PLAYER }

        // The table is prepared with the real repository, that creates the real schema, not with a schema made up by the test.
        function databaseWithOneAccount(): string {
            const databasePath = join(workDirectory, 'one.db')
            const database = new Database(databasePath)
            try {
                void new SqliteUserRepository(database).insert(STORED)
            } finally {
                database.close()
            }
            return databasePath
        }

        it('US-002/CA-7 skips the seed: this account alone stays, and no account is added', () => {
            const databasePath = databaseWithOneAccount()
            const accountsBefore = accounts(databasePath)
            expect(accountsBefore).toEqual([{ id: STORED.id, login: STORED.username, hash: STORED.password, role: 'buzzer' }])

            const result = seed(databasePath)

            expectSkippedSeed(result)
            expect(accounts(databasePath)).toEqual(accountsBefore)
        }, TEST_TIMEOUT_MS)

        it('US-002/CA-7 skips the seed on this table even with a wrong password and an invalid BCRYPT_COST', () => {
            const databasePath = databaseWithOneAccount()
            const accountsBefore = accounts(databasePath)

            const result = seed(databasePath, { SEED_PASSWORD_ADMIN: 'short', BCRYPT_COST: 'abc' })

            expectSkippedSeed(result)
            expect(accounts(databasePath)).toEqual(accountsBefore)
        }, TEST_TIMEOUT_MS)
    })
})
