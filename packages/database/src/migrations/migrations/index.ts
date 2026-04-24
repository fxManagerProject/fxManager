import { m0000_grey_mother_askani } from './0000_grey_mother_askani';
import type { Migration } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// DATABASE MIGRATION GUIDE
//
// Do not manually create or register files in this directory. 
// Use the automated migration utility:
//
// 1. PROCESS: Run `bun run db:migrate` to detect new SQL files,
//    prompt for a description, and automatically:
//    - Create the corresponding .ts migration file.
//    - Sanitize and split the SQL queries.
//    - Register the migration in the array below.
//
// RULES:
// - IMMUTABILITY: Never edit a migration file (.ts or .sql or .json) once deployed.
// ─────────────────────────────────────────────────────────────────────────────

export const migrations: Migration[] = [m0000_grey_mother_askani];
