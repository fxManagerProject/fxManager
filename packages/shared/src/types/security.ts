import type { UserPermissions } from '../constants';

export type UserPermissionsType =
	(typeof UserPermissions)[keyof typeof UserPermissions];

export type AuditAction =
	| 'server.start'
	| 'server.stop'
	| 'server.restart'
	| 'player.ban'
	| 'player.unban'
	| 'player.kick'
	| 'settings.update';

export interface AuditEntry {
	id: number;
	adminId: string;
	action: AuditAction;
	target?: string;
	metadata?: Record<string, unknown>;
	createdAt: Date;
}
