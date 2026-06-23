import { and, eq, inArray } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import * as schema from '../schema';
import type {
	ImportAction,
	ImportPlayer,
	TxAdminIdentifier,
	TxAdminImport,
} from './txadmin';

type DB = BunSQLiteDatabase<typeof schema>;
type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];

export interface ImportSummary {
	players: { created: number; matched: number };
	identifiers: { created: number };
	notes: { created: number };
	bans: { created: number; skipped: number };
	warns: { created: number; skipped: number };
	stubPlayers: number;
	whitelist: { created: number };
}

function emptySummary(): ImportSummary {
	return {
		players: { created: 0, matched: 0 },
		identifiers: { created: 0 },
		notes: { created: 0 },
		bans: { created: 0, skipped: 0 },
		warns: { created: 0, skipped: 0 },
		stubPlayers: 0,
		whitelist: { created: 0 },
	};
}

const { players, playerIdentifiers, playerNotes, bans, warns } = schema;
const whitelist = schema.whitelistedIdentifers;

function findPlayerId(tx: Tx, identifiers: TxAdminIdentifier[]): number | null {
	const values = identifiers.map((i) => i.value);
	if (values.length === 0) return null;

	const row = tx
		.select({ playerId: playerIdentifiers.playerId })
		.from(playerIdentifiers)
		.where(inArray(playerIdentifiers.value, values))
		.limit(1)
		.get();

	return row?.playerId ?? null;
}

function insertIdentifiers(
	tx: Tx,
	playerId: number,
	identifiers: TxAdminIdentifier[],
): number {
	if (identifiers.length === 0) return 0;

	const inserted = tx
		.insert(playerIdentifiers)
		.values(identifiers.map((i) => ({ ...i, playerId })))
		.onConflictDoNothing()
		.returning()
		.all();

	return inserted.length;
}

function importPlayer(
	tx: Tx,
	player: ImportPlayer,
	summary: ImportSummary,
): number {
	const existingId = findPlayerId(tx, player.identifiers);

	let playerId: number;
	if (existingId !== null) {
		summary.players.matched++;
		playerId = existingId;
	} else {
		const row = tx
			.insert(players)
			.values({
				name: player.name,
				playtime: player.playtime,
				firstSeen: player.firstSeen,
				lastSeen: player.lastSeen,
			})
			.returning()
			.get();
		summary.players.created++;
		playerId = row.id;
	}

	summary.identifiers.created += insertIdentifiers(
		tx,
		playerId,
		player.identifiers,
	);

	if (player.note) {
		const existingNote = tx
			.select({ id: playerNotes.id })
			.from(playerNotes)
			.where(
				and(
					eq(playerNotes.playerId, playerId),
					eq(playerNotes.content, player.note.content),
				),
			)
			.get();

		if (!existingNote) {
			tx.insert(playerNotes)
				.values({
					playerId,
					content: player.note.content,
					issuer: null,
					issuedAt: player.note.issuedAt,
				})
				.run();
			summary.notes.created++;
		}
	}

	return playerId;
}

function resolveActionPlayer(
	tx: Tx,
	action: ImportAction,
	summary: ImportSummary,
): number {
	const existingId = findPlayerId(tx, action.identifiers);
	if (existingId !== null) return existingId;

	const row = tx
		.insert(players)
		.values({
			name: action.playerName,
			playtime: 0,
			firstSeen: action.createdAt,
			lastSeen: action.createdAt,
		})
		.returning()
		.get();

	insertIdentifiers(tx, row.id, action.identifiers);
	summary.stubPlayers++;

	return row.id;
}

function importAction(tx: Tx, action: ImportAction, summary: ImportSummary) {
	const playerId = resolveActionPlayer(tx, action, summary);

	if (action.type === 'ban') {
		const existing = tx
			.select({ id: bans.id })
			.from(bans)
			.where(
				and(
					eq(bans.playerId, playerId),
					eq(bans.createdAt, action.createdAt),
					eq(bans.reason, action.reason),
				),
			)
			.get();

		if (existing) {
			summary.bans.skipped++;
			return;
		}

		tx.insert(bans)
			.values({
				playerId,
				reason: action.reason,
				issuer: null,
				expiresAt: action.expiresAt,
				createdAt: action.createdAt,
				revokedAt: action.revokedAt,
			})
			.run();
		summary.bans.created++;
		return;
	}

	const existing = tx
		.select({ id: warns.id })
		.from(warns)
		.where(
			and(
				eq(warns.playerId, playerId),
				eq(warns.issuedAt, action.createdAt),
				eq(warns.reason, action.reason),
			),
		)
		.get();

	if (existing) {
		summary.warns.skipped++;
		return;
	}

	tx.insert(warns)
		.values({
			playerId,
			reason: action.reason,
			issuer: null,
			read: action.acked ? 1 : 0,
			revoked: action.revokedAt ? 1 : 0,
			issuedAt: action.createdAt,
		})
		.run();
	summary.warns.created++;
}

export function importTxAdmin(db: DB, data: TxAdminImport): ImportSummary {
	const summary = emptySummary();

	db.transaction((tx) => {
		for (const player of data.players) {
			importPlayer(tx, player, summary);
		}

		for (const action of data.actions) {
			importAction(tx, action, summary);
		}

		for (const entry of data.whitelist) {
			const inserted = tx
				.insert(whitelist)
				.values({
					type: entry.type,
					value: entry.value,
					adminId: null,
					system: 1,
					addedAt: entry.addedAt,
				})
				.onConflictDoNothing()
				.returning()
				.all();

			summary.whitelist.created += inserted.length;
		}
	});

	return summary;
}
