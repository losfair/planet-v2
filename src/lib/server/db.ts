import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { SCHEMA } from './schema';

const DATABASE_PATH = process.env.DATABASE_PATH || './data/planet.sqlite';

// Ensure the parent directory exists before opening.
try {
	mkdirSync(dirname(DATABASE_PATH), { recursive: true });
} catch {
	/* ignore */
}

export const db = new Database(DATABASE_PATH, { create: true });
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');

// Apply schema (idempotent — all statements use IF NOT EXISTS).
db.exec(SCHEMA);

/** Run a function inside a transaction. */
export function tx<T>(fn: () => T): T {
	return db.transaction(fn)();
}
