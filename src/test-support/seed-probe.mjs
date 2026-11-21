// Test-only module, preloaded into the real seed process (`NODE_OPTIONS=--import=<this file>`) by src/seed-all-or-none.test.ts.
// It changes no behaviour of the seed: it only observes the statements that `better-sqlite3` runs, to hold or to stop the process at chosen points.
// It is inert without its variables, and it is never loaded by production code. Two modes, chosen by the environment:
//
// - race (SEED_PROBE_DIR, SEED_PROBE_NAME, SEED_PROBE_PEER): two seed processes meet at two points, so that the race is real and not left to the luck of the schedule.
//   1. after the first read of the account count (outside any transaction, the check of step 2 of US-002), each process announces itself and waits for the other:
//      both have seen the empty table before either writes.
//   2. after the read of the account count inside the write transaction, each process waits until the other has announced that it is about to begin its own transaction
//      (a marker written before `BEGIN`), then a short settling time: the other one has had the time to read the table (deferred transaction) or to queue on the write lock (immediate).
//   Waiting for the peer inside the transaction cannot deadlock the run that holds the lock: the marker is written before the peer blocks on `BEGIN`.
// - kill (SEED_PROBE_DIR, SEED_PROBE_KILL_AT = `create-table:before`, `create-table:after`, `insert:N` or `commit`): the process is killed with SIGKILL right before the
//   `CREATE TABLE IF NOT EXISTS T_USER_USR` runs (the statement is not executed), right after it ran (the table exists, empty), right after its N-th `INSERT INTO T_USER_USR`,
//   or right after the `COMMIT` of its write transaction. A marker file `killed-at-<point>` (`:` written `-`) is written first, so the test can tell that the point was reached.
import { createRequire } from 'node:module'
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const { SEED_PROBE_DIR: directory, SEED_PROBE_NAME: name, SEED_PROBE_PEER: peer, SEED_PROBE_KILL_AT: killAt } = process.env
const WAIT_CAP_MS = 20_000
const SETTLING_MS = 200

const sleep = (milliseconds) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds)
const mark = (file) => writeFileSync(join(directory, file), '')
function waitFor(file) {
    const deadline = Date.now() + WAIT_CAP_MS
    while (!existsSync(join(directory, file)) && Date.now() < deadline) sleep(5)
}

if (directory !== undefined) {
    const Database = createRequire(import.meta.url)('better-sqlite3')
    const probeDatabase = new Database(':memory:')
    const statement = Object.getPrototypeOf(probeDatabase.prepare('SELECT 1'))
    probeDatabase.close()
    const originalGet = statement.get
    const originalRun = statement.run
    const isCount = (source) => source.startsWith('SELECT COUNT(USR_LOGIN)')
    const isInsert = (source) => source.startsWith('INSERT INTO T_USER_USR')
    const isCreateTable = (source) => source.startsWith('CREATE TABLE IF NOT EXISTS T_USER_USR')
    const killHere = (point) => {
        mark('killed-at-' + point.replace(':', '-'))
        process.kill(process.pid, 'SIGKILL')
        sleep(10_000)
    }
    let inserts = 0

    statement.get = function (...parameters) {
        const row = originalGet.apply(this, parameters)
        if (name !== undefined && peer !== undefined && isCount(this.source)) {
            if (!this.database.inTransaction) {
                mark(name + '.checked')
                waitFor(peer + '.checked')
            } else {
                waitFor(peer + '.begun')
                sleep(SETTLING_MS)
            }
        }
        return row
    }
    statement.run = function (...parameters) {
        if (name !== undefined && this.source.startsWith('BEGIN')) mark(name + '.begun')
        if (killAt === 'create-table:before' && isCreateTable(this.source)) killHere(killAt)
        const result = originalRun.apply(this, parameters)
        if (killAt === 'create-table:after' && isCreateTable(this.source)) killHere(killAt)
        if (killAt !== undefined && (this.source === 'COMMIT' ? killAt === 'commit' : isInsert(this.source) && killAt === 'insert:' + ++inserts)) killHere(killAt)
        return result
    }
}
