// Test-only process (spawned by src/seed-all-or-none.test.ts): it holds the write lock of a SQLite database (`BEGIN IMMEDIATE`) until its standard input is closed,
// so that a seed launched meanwhile cannot get the lock. It never writes anything: the transaction is rolled back at the end.
// It prints `locked` once the lock is held. It waits on its standard input, not on a clock: the test decides how long the lock is held.
import { createRequire } from 'node:module'

const Database = createRequire(import.meta.url)('better-sqlite3')
const database = new Database(process.env.LOCK_DB_PATH, { fileMustExist: true })
database.exec('BEGIN IMMEDIATE')
process.stdout.write('locked\n')
process.stdin.resume()
process.stdin.on('end', () => {
    database.exec('ROLLBACK')
    database.close()
    process.exit(0)
})
