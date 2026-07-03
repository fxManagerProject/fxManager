import type { Migration } from '../types';

export const m0005_disconnect_events: Migration = {
	version: 5,
	description:
		'Add disconnect_events for per-drop timestamps (time-range stats)',
	up: [
		`CREATE TABLE \`disconnect_events\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`session_id\` integer NOT NULL,
	\`ts\` integer NOT NULL,
	\`category\` text NOT NULL,
	FOREIGN KEY (\`session_id\`) REFERENCES \`server_sessions\`(\`id\`) ON UPDATE no action ON DELETE cascade
)`,
		`CREATE INDEX \`disconnect_event_session_ts_idx\` ON \`disconnect_events\` (\`session_id\`, \`ts\`)`,
	],
};
