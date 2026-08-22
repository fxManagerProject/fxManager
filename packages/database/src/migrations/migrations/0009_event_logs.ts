import type { Migration } from '../types';

export const m0009_event_logs: Migration = {
	version: 9,
	description: 'Add event_logs table for game event tracking',
	up: [
		`CREATE TABLE \`event_logs\` (
			\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
			\`event\` text NOT NULL,
			\`timestamp\` integer NOT NULL,
			\`player_id\` integer REFERENCES players(id) ON DELETE SET NULL,
			\`player_name\` text,
			\`server_session_id\` integer REFERENCES server_sessions(id) ON DELETE SET NULL,
			\`data\` text NOT NULL
		)`,
		`CREATE INDEX \`event_logs_event_idx\` ON \`event_logs\` (\`event\`)`,
		`CREATE INDEX \`event_logs_player_idx\` ON \`event_logs\` (\`player_id\`)`,
		`CREATE INDEX \`event_logs_ts_idx\` ON \`event_logs\` (\`timestamp\`)`,
		`CREATE INDEX \`event_logs_session_idx\` ON \`event_logs\` (\`server_session_id\`)`,
	],
};
