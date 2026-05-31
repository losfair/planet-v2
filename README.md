# Planet v2

A re-creation of [Bluebird / Planet](../bluebird) — a minimal web app for writing
and sharing short notes — built entirely on **modern, publicly-available web tech**:

| Layer        | Original (Bluebird)      | This re-creation            |
| ------------ | ------------------------ | --------------------------- |
| Runtime      | Blueboat (private)       | **Bun**                     |
| Frontend     | Next.js 12 + Chakra UI   | **SvelteKit + Svelte 5**    |
| Primary data | Blueboat KV              | **SQLite** (`bun:sqlite`)   |
| Analytics/FTS| ClickHouse               | **SQLite** + FTS5           |
| Blobs        | S3                       | **S3** (+ local-disk fallback) |
| Auth         | Auth0                    | local sessions (argon2id)   |

The UI is reproduced to stay **visually identical** to the original Chakra-based
app (same layout, palette, light/dark mode, masonry note grid, sidebar tabs),
while the front- and back-end logic were re-designed from scratch.

## Features

- User profiles, public/private notes, markdown rendering, image embeds
- Masonry note feed with infinite scroll; pinned (top) notes
- Bidirectional links (forward links + backlinks), @-mentions, hierarchical #tags
- Full-text search (SQLite FTS5) + tag filtering
- **Lenses** — saved structured queries with a custom query language
  (`tag work and public`, `every day after 09:00 utc`, …), parser re-implemented
  in TypeScript (originally a Rust/WASM LALRPOP grammar)
- Follow system, global / follow / user streams, notifications
- Image upload via S3 presigned PUT (local-disk fallback for dev)
- RSS feed per user
- Dark mode (system default + `Shift+D` toggle), responsive desktop/mobile

## Getting started

```bash
bun install

# configure (optional — sensible dev defaults are used otherwise)
cp .env.example .env

# create demo data (users: zhy / ada, password: "password")
DATABASE_PATH=./data/planet.sqlite bun run scripts/seed.ts

# dev server  → http://localhost:3030
DATABASE_PATH=./data/planet.sqlite bun run dev
```

### Production

```bash
bun run build
DATABASE_PATH=./data/planet.sqlite PORT=3000 bun ./build/index.js
```

> **Note:** the npm scripts use `bun --bun vite …` so Vite runs under the Bun
> runtime. This is required because `bun:sqlite` is a Bun built-in; running Vite
> under Node (its default shebang) would fail to resolve it.

## Configuration

See `.env.example`. Without S3 credentials the app stores uploaded images on
local disk under `data/img/` and serves them from `/img/*`. Point
`S3_ENDPOINT` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_BUCKET` /
`S3_PUBLIC_BASE_URL` at any S3-compatible store (AWS S3, Cloudflare R2, MinIO)
to use real object storage.

## Layout

```
src/
  lib/
    server/        DB, schema, auth, notes, queries, lens, search, follow,
                   tags, image (S3), notifications, markdown, parsing
    components/    Svelte UI (PeoplePage, Snippet, NoteList, Sidebar, DashWrite,
                   LensView, Settings, Menu/Modal/Button/Avatar, …)
    client/        api(loadJson), colorMode, toast, notePopup, format
  routes/
    +page.svelte               product landing
    login, signup              auth
    people/[username]/...      notes, [note], tag/[tag], lens/[id]
    api/v1/..., me/api/v1/...   JSON API (mirrors the original contract)
    feed/[username].xml        RSS
    img/[...path]              local image store (dev fallback)
```

## Database migrations

Schema changes are versioned via SQLite's `PRAGMA user_version` and applied on
startup by `runMigrations()` in `src/lib/server/migrations.ts`. Migration 1 is
the frozen baseline (`schema.sql`). **To change the schema, append a new
migration** with the next version number and its `ALTER TABLE` / `CREATE`
statements — don't edit released migrations or the baseline. Fresh databases
replay every migration in order; existing databases run only the pending ones,
each in a transaction.

## Not yet ported

Features that depended on third-party services or heavy client libraries are
out of scope for this rebuild: the vis-network graph view, Notion / Telegram /
Stripe / AWS-OCR integrations, custom hostnames, cryptographic seals, and the
activity-map PNG renderer.
