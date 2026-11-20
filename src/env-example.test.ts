import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'dotenv'
import { describe, expect, it } from 'vitest'
import { OwaspPasswordValidator } from './users/owasp-password-validator'

// `.env.example` is the versioned model of the `.env` of the seed and of the hub (US-002, « Format du fichier .env » and « Modèle partagé avec le hub »;
// US-003, « Fichier `.env` et sécurité »; decisions #75 and #76). Copied as it is to `.env`, it must change no behaviour but two refusals:
// the seed refuses it (US-002/CA-4), because each placeholder is one character shorter than the minimum of the password policy, and the hub
// refuses it (US-001/CA-1, US-003/CA-19), because JWT_SECRET has no value. The optional variables are only written as comments (a value left
// empty is refused for SQLITE_DB_PATH and read as absent for BCRYPT_COST and JWT_EXPIRATION). The two refusals on the real process are proved
// by seed.test.ts and index.test.ts.
const MODEL = readFileSync(resolve(__dirname, '../.env.example'), 'utf8')
const LINES = MODEL.split(/\r?\n/)
const SEED_VARIABLES = [
    'SEED_PASSWORD_ADMIN',
    ...Array.from({ length: 10 }, (_, index) => `SEED_PASSWORD_BUZZER_${String(index + 1).padStart(2, '0')}`)
]
const PLACEHOLDER = '<a_changer>'
const JWT_VARIABLES = ['JWT_SECRET']

// The minimum of CA-4 is not exported by the production code (it is written in the validator): it is read from the validator itself,
// as the shortest string of printable characters that it accepts, so that the invariant follows the policy and not a copy of its figure.
function minimumPasswordLength(): number {
    const validator = new OwaspPasswordValidator()
    const shortest = Array.from({ length: 72 }, (_, index) => index + 1).find(length => validator.validate('a'.repeat(length)))
    if (shortest === undefined) throw new Error('the password policy accepts no length from 1 to 72')
    return shortest
}

describe('.env.example', () => {
    it('defines the hub JWT secret and the eleven seed password variables, and nothing else', () => {
        expect(Object.keys(parse(MODEL)).sort()).toEqual([...JWT_VARIABLES, ...SEED_VARIABLES].sort())
    })

    it('writes JWT_SECRET without any value, so that an unedited copy is refused by the hub (US-001 CA-1, US-003 CA-19)', () => {
        expect(LINES).toContain('JWT_SECRET=')
        expect(parse(MODEL).JWT_SECRET).toBe('')
    })

    it('gives each of the eleven seed passwords the placeholder <a_changer>, never a real value', () => {
        const seedValues = Object.fromEntries(Object.entries(parse(MODEL)).filter(([name]) => name.startsWith('SEED_PASSWORD_')))
        expect(seedValues).toEqual(Object.fromEntries(SEED_VARIABLES.map(name => [name, PLACEHOLDER])))
    })

    it('keeps each seed placeholder strictly shorter than the minimum of the password policy (CA-4), so that an unedited copy is refused', () => {
        const minimum = minimumPasswordLength()
        for (const name of SEED_VARIABLES) {
            const value = parse(MODEL)[name] ?? ''
            expect(value.length, `${name} must be shorter than ${minimum} characters`).toBeLessThan(minimum)
            expect(new OwaspPasswordValidator().validate(value), `${name} must be refused by the policy`).toBe(false)
        }
    })

    it.each(['BCRYPT_COST', 'SQLITE_DB_PATH', 'JWT_EXPIRATION'])('writes %s as a comment only, with its default', name => {
        const written = LINES.filter(line => line.includes(name))
        const commentedDefault = new RegExp(`^# ${name}=\\S+$`)
        expect(written.some(line => commentedDefault.test(line))).toBe(true)
        expect(written.every(line => line.startsWith('#'))).toBe(true)
    })

    it('writes JWT_EXPIRATION with its default 3600 (US-003 CA-4)', () => {
        expect(LINES).toContain('# JWT_EXPIRATION=3600')
    })

    it('writes the rule of JWT_SECRET on the line above it: required, 32 characters minimum', () => {
        const rule = LINES[LINES.indexOf('JWT_SECRET=') - 1] ?? ''
        expect(rule).toMatch(/^#/)
        expect(rule).toContain('32')
        expect(rule).toContain('obligatoire')
    })

    it('writes the rule of JWT_EXPIRATION on the line above it: strictly positive integer, absent or empty means 3600', () => {
        const rule = LINES[LINES.indexOf('# JWT_EXPIRATION=3600') - 1] ?? ''
        expect(rule).toMatch(/^#/)
        expect(rule).toContain('strictement positif')
        expect(rule).toContain('3600')
    })

    it('says in its header that it is a model to copy to .env, then to edit', () => {
        expect(LINES[0]).toBe('# Modèle du .env : copier en .env (non versionné), puis remplacer chaque valeur')
    })
})
