import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { databasePath, openDatabase } from './client';

const path = databasePath();
const db = openDatabase(path);
migrate(db, { migrationsFolder: './drizzle' });
console.log(`Migrations applied to ${path}`);
