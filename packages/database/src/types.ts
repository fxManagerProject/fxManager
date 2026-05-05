import type {
	BaseAdminUser,
	Player,
	PlayerIdentifiers,
} from '@fxmanager/shared/types';
import type {
	adminUsers,
	auditLog,
	bans,
	kicks,
	playerNotes,
	reports,
	warns,
} from './schema';

export type Ban = typeof bans.$inferSelect;
export type Warn = typeof warns.$inferSelect;
export type Kick = typeof kicks.$inferSelect;
export type PlayerNote = typeof playerNotes.$inferSelect;
export type AdminSelect = Omit<typeof adminUsers.$inferSelect, 'passwordHash'>;

export interface PlayerProfile extends Player {
	identifiers: PlayerIdentifiers;
	isStaff: boolean;
	adminProfile?: Omit<typeof adminUsers.$inferSelect, 'passwordHash'>;
	punishments: {
		bans: (typeof bans.$inferSelect)[];
		warns: (typeof warns.$inferSelect)[];
		kicks: (typeof kicks.$inferSelect)[];
	};
	reports: (typeof reports.$inferSelect)[];
	notes: (typeof playerNotes.$inferSelect)[];
}

export type AuditLog = typeof auditLog.$inferSelect;

export interface AdminProfile extends BaseAdminUser {
	auditLogs: AuditLog[];
	playerName: string | null;
}
