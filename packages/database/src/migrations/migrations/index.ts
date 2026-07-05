import { m0007_player_sessions } from './0007_player_sessions';
import { m0006_admin_groups } from './0006_admin_groups';
import { m0005_disconnect_events } from './0005_disconnect_events';
import { m0004_disconnect_sessions } from './0004_disconnect_sessions';
import { m0003_jittery_mystique } from './0003_jittery_mystique';
import { m0002_dry_molten_man } from './0002_dry_molten_man';
import { m0001_dapper_landau } from './0001_dapper_landau';
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

export const migrations: Migration[] = [
	m0000_grey_mother_askani,
	m0001_dapper_landau,
	m0002_dry_molten_man,
	m0003_jittery_mystique,
	m0004_disconnect_sessions,
	m0005_disconnect_events,
	m0006_admin_groups,
	m0007_player_sessions,
];
