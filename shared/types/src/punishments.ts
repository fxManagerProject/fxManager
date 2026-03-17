import { adminUsers, bans, kicks, playerNotes, reports, warns } from '@fxmanager/database';

export type Ban = typeof bans.$inferSelect;
export type Warn = typeof warns.$inferSelect;
export type Kick = typeof kicks.$inferSelect;
export type PlayerNote = typeof playerNotes.$inferSelect;
