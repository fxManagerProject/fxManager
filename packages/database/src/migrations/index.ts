import { migration_0001_initial } from './migrations/0001_initial_migration';
import { migration_0002_auth } from './migrations/0002_add_auth';
import type { Migration } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// DATABASE MIGRATION GUIDE
//
// Follow these steps to modify the database schema:
//
// 1. CREATE: Add a new file in `./migrations/` using the naming convention:
//    `XXXX_short_description.ts` (e.g., 0002_add_player_notes.ts)
//
// 2. IMPLEMENT: Define the `Migration` object.
//    - Increment the `version` number by 1.
//    - Use the `up` array for your SQL statements.
//
// 3. REGISTER: Import and add your new migration to the `migrations` array below.
//    The order in this array determines the execution order.
//
// RULES:
// - IMMUTABILITY: Never edit a migration that has already been deployed.
// - ATOMICITY: Each string in the `up` array should be a single logical command.
// - CONSISTENCY: Ensure `version` matches the filename prefix.
// ─────────────────────────────────────────────────────────────────────────────

export const migrations: Migration[] = [migration_0001_initial, migration_0002_auth];
