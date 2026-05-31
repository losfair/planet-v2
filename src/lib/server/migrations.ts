import type { Database } from 'bun:sqlite';
import { SCHEMA } from './schema';

/**
 * Versioned schema migrations, keyed on SQLite's `PRAGMA user_version`.
 *
 * Rules:
 *  - Migration 1 is the frozen baseline (the full `schema.sql`). It uses
 *    `CREATE ... IF NOT EXISTS`, so it's a safe no-op on databases that were
 *    bootstrapped before migrations existed.
 *  - To change the schema, APPEND a new entry with the next version number
 *    containing the necessary `ALTER TABLE` / `CREATE` statements. Never edit
 *    an already-released migration or the baseline — fresh databases replay
 *    every migration in order, so the final shape must be reachable that way.
 *
 * Each `up` runs inside a transaction; the runner bumps `user_version`
 * afterwards.
 */
export interface Migration {
	version: number;
	name: string;
	up: (db: Database) => void;
}

export const migrations: Migration[] = [
	{
		version: 1,
		name: 'baseline',
		up: (db) => db.exec(SCHEMA)
	}
	// Example of a future migration:
	// {
	//   version: 2,
	//   name: 'add notes.pinned',
	//   up: (db) => db.exec('ALTER TABLE notes ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;')
	// }
];

/** Apply all pending migrations. Returns the resulting schema version. */
export function runMigrations(db: Database): number {
	const row = db.query('PRAGMA user_version').get() as { user_version: number };
	let current = row.user_version ?? 0;

	const pending = migrations
		.filter((m) => m.version > current)
		.sort((a, b) => a.version - b.version);

	for (const m of pending) {
		db.transaction(() => {
			m.up(db);
			// PRAGMA can't be parameterized; version is an integer from our code.
			db.exec(`PRAGMA user_version = ${m.version}`);
		})();
		current = m.version;
	}

	return current;
}
