import type { Migration } from '../types';

export const m0007_player_sessions: Migration = {
	version: 7,
	description: 'Add player_sessions for per-session activity + heat map',
	up: [
		`CREATE TABLE \`player_sessions\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`player_id\` integer NOT NULL,
	\`server_session_id\` integer,
	\`connected_at\` integer NOT NULL,
	\`disconnected_at\` integer,
	\`duration_ms\` integer,
	\`end_reason\` text,
	FOREIGN KEY (\`player_id\`) REFERENCES \`players\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`server_session_id\`) REFERENCES \`server_sessions\`(\`id\`) ON UPDATE no action ON DELETE set null
)`,
		`CREATE INDEX \`player_session_player_connected_idx\` ON \`player_sessions\` (\`player_id\`, \`connected_at\`)`,
	],
};
