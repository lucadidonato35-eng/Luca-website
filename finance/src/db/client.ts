import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

export const DEFAULT_DB_PATH = './data/cockpit.db';

export function databasePath(): string {
  return resolve(process.env.DATABASE_PATH ?? DEFAULT_DB_PATH);
}

/**
 * Opens the local SQLite file. Nothing here talks to a network.
 *
 * Phase 6 swaps `better-sqlite3` for `better-sqlite3-multiple-ciphers` and adds
 * a `PRAGMA key` here; that is the only place encryption at rest needs to touch.
 */
export function openDatabase(path: string = databasePath()) {
  mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  return drizzle(sqlite, { schema });
}

export type Db = ReturnType<typeof openDatabase>;

/**
 * Next.js dev-mode module reloading would otherwise open a new handle on every
 * request, so the connection is cached on globalThis.
 */
const globalForDb = globalThis as unknown as { cockpitDb?: Db };

export function getDb(): Db {
  globalForDb.cockpitDb ??= openDatabase();
  return globalForDb.cockpitDb;
}

export { schema };
