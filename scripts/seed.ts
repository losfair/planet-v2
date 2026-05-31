/**
 * Seed the database with demo users and notes so the UI has content.
 * Run with: bun run scripts/seed.ts
 */
import { createUser, getUser } from '../src/lib/server/users';
import { createNote } from '../src/lib/server/notes';
import { follow } from '../src/lib/server/follow';
import { editLens } from '../src/lib/server/lens';
import { db } from '../src/lib/server/db';

async function ensureUser(username: string, displayName: string, description: string) {
	if (!getUser(username)) {
		await createUser({ username, email: `${username}@example.com`, password: 'password' });
	}
	db.query('UPDATE users SET display_name = ?, description = ? WHERE username = ?').run(
		displayName,
		description,
		username
	);
}

async function main() {
	await ensureUser('zhy', 'Heyang', 'Building Planet. Notes about systems, distributed databases, and ideas.\nhttps://planet.ink');
	await ensureUser('ada', 'Ada Lovelace', 'Mathematician. Thinking in #math and #poetry.');

	const zhyNotes = [
		'Welcome to **Planet** — a place for short notes. Use #tags, [links](https://planet.ink), and `code`.',
		'Working on a SQLite-backed re-implementation today. #engineering/databases SQLite FTS5 is surprisingly capable.',
		'A network of short notes has its own spontaneous order. #ideas',
		'Bidirectional links connect thoughts across time. Try mentioning @ada in a note. #engineering',
		'> The best way to predict the future is to invent it.\n\n#quotes',
		'Reading about LSM-trees and write amplification. #engineering/databases #reading',
		'Markdown table:\n\n| Feature | Status |\n| --- | --- |\n| Notes | ✓ |\n| Lenses | ✓ |\n| Search | ✓ |'
	];
	for (const c of zhyNotes) {
		createNote('zhy', { content: c, private: false });
	}
	createNote('zhy', { content: 'A private thought, just for me. #journal', private: true });

	for (const c of [
		'Poetry is the music of the soul. #poetry',
		'On the Analytical Engine and what it could compute. #math',
		'Numbers have a beauty of their own. #math #poetry'
	]) {
		createNote('ada', { content: c, private: false });
	}

	follow('ada', 'zhy');
	follow('zhy', 'ada');

	try {
		editLens('zhy', {
			id: 'engineering',
			description: 'Engineering notes',
			query: 'tag engineering and public',
			access: 'public',
			update: true
		});
	} catch (e) {
		console.error('lens seed:', e);
	}

	console.log('Seeded. Users: zhy / ada (password: "password")');
}

main();
