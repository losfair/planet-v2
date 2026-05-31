// Auto-derived from schema.sql — embedded as a string so it bundles under
// both the Bun runtime (seed script) and Vite (build) without fs reads.
export const SCHEMA = `
-- Planet v2 schema (SQLite). Replaces Blueboat KV + ClickHouse.
-- Everything that the original stored across KV namespaces and ClickHouse
-- tables lives here; binary blobs (images) live in S3, referenced by URL.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  username              TEXT PRIMARY KEY,
  email                 TEXT UNIQUE,
  password_hash         TEXT NOT NULL,
  display_name          TEXT NOT NULL DEFAULT '',
  description           TEXT NOT NULL DEFAULT '',
  join_ts               INTEGER NOT NULL,            -- ms epoch
  invited_by            TEXT,
  invited_at            INTEGER,
  top_note              TEXT,                         -- pinned note id
  content_font_family   TEXT,                         -- 'serif' | 'monospace' | null
  note_view_v2          INTEGER NOT NULL DEFAULT 0,
  wayback_json          TEXT,                         -- {where, ak, sk} | null
  openapi_invalidate_before INTEGER NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- Notes (diary entries / snippets)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notes (
  username       TEXT NOT NULL,
  id             TEXT NOT NULL,            -- full id: YYYY-MM-DD-<hex>
  real_ts        INTEGER NOT NULL,         -- creation ms epoch
  edit_count     INTEGER NOT NULL DEFAULT 0,
  content_html   TEXT NOT NULL,            -- rendered, sanitized HTML
  markdown       TEXT NOT NULL,            -- raw markdown source
  private        INTEGER NOT NULL DEFAULT 0,
  deliverable_ts INTEGER,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,
  PRIMARY KEY (username, id),
  FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_notes_user_ts ON notes (username, real_ts DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_notes_public_ts ON notes (private, real_ts DESC, id DESC);

-- Forward links between notes (source -> target). Backlinks = reverse lookup.
CREATE TABLE IF NOT EXISTS note_links (
  from_username  TEXT NOT NULL,
  from_id        TEXT NOT NULL,
  to_username    TEXT NOT NULL,
  to_id          TEXT NOT NULL,
  position       INTEGER NOT NULL DEFAULT 0,
  text           TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (from_username, from_id, to_username, to_id),
  FOREIGN KEY (from_username) REFERENCES users(username) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_links_to ON note_links (to_username, to_id);

-- Hashtags extracted from note content (hierarchical: a, a/b, a/b/c).
CREATE TABLE IF NOT EXISTS note_tags (
  username  TEXT NOT NULL,
  note_id   TEXT NOT NULL,
  tag       TEXT NOT NULL,
  private   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (username, note_id, tag),
  FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_tags_user ON note_tags (username, tag);

-- Per-note annotations (color highlighting).
CREATE TABLE IF NOT EXISTS annotations (
  username   TEXT NOT NULL,
  note_id    TEXT NOT NULL,
  color      TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (username, note_id),
  FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
);

-- Full-text search index over note plaintext. Managed manually.
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  text,
  username UNINDEXED,
  note_id UNINDEXED,
  tokenize = 'unicode61'
);

-- ---------------------------------------------------------------------------
-- Social graph
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS follows (
  from_username TEXT NOT NULL,
  to_username   TEXT NOT NULL,
  ts            INTEGER NOT NULL,
  PRIMARY KEY (from_username, to_username),
  FOREIGN KEY (from_username) REFERENCES users(username) ON DELETE CASCADE,
  FOREIGN KEY (to_username)   REFERENCES users(username) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_follows_to ON follows (to_username, ts DESC);
CREATE INDEX IF NOT EXISTS idx_follows_from ON follows (from_username, ts DESC);

-- ---------------------------------------------------------------------------
-- Lenses (saved structured queries)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lenses (
  username      TEXT NOT NULL,
  id            TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  query         TEXT NOT NULL DEFAULT '',
  expr_json     TEXT,                       -- parsed GraphQueryExpr
  access        TEXT NOT NULL DEFAULT 'private', -- private|group|public|public-hidden
  group_json    TEXT,                       -- string[] of usernames
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (username, id),
  FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- Notifications (at-mention, link, follow)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient  TEXT NOT NULL,
  ts         INTEGER NOT NULL,
  notif_type TEXT NOT NULL,               -- at_mention | link | follow
  payload    TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (recipient) REFERENCES users(username) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_notif_recipient ON notifications (recipient, seq DESC);

-- ---------------------------------------------------------------------------
-- Images (metadata only; bytes live in S3)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS images (
  username     TEXT NOT NULL,
  filename     TEXT NOT NULL,             -- <username>/<imageId>.<ext>
  content_type TEXT NOT NULL,
  size         INTEGER NOT NULL,
  created_at   INTEGER NOT NULL,
  PRIMARY KEY (filename),
  FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
);

-- Per-user monotonic counter for note id sequencing within a day.
CREATE TABLE IF NOT EXISTS user_seq (
  username TEXT PRIMARY KEY,
  seq      INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------------
-- Sessions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  username   TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (username);

-- Audit/version-history log (replaces the seqlog). Append-only.
CREATE TABLE IF NOT EXISTS event_log (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT,
  ts         INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  note_id    TEXT,
  value      TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_eventlog_user ON event_log (username, seq DESC);
CREATE INDEX IF NOT EXISTS idx_eventlog_note ON event_log (username, note_id, seq DESC);
`;
