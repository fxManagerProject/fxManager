import { m0008_vengeful_microbe } from './0008_vengeful_microbe';
import { m0007_petite_skrulls } from './0007_petite_skrulls';
import { m0006_productive_thor } from './0006_productive_thor';
import { m0005_chubby_daredevil } from './0005_chubby_daredevil';
import { m0004_uneven_silver_sable } from './0004_uneven_silver_sable';
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
	m0004_uneven_silver_sable,
	m0005_chubby_daredevil,
	m0006_productive_thor,
	m0007_petite_skrulls,
	m0008_vengeful_microbe,
];
