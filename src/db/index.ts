import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';

// تأكد أن المسار لملف sqlite.db هو نفس المسار في drizzle.config.ts
export const sqlite = new Database('sqlite.db');
export const db = drizzle(sqlite, { schema });