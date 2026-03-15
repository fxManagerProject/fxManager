import { adminUsers, bans, kicks, playerNotes, reports, warns } from "@fxmanager/database";

export interface PlayerIdentifiers {
  license: string;
  fivem?: string;
  discord?: string;
  steam?: string;
}

export interface Player {
  id: number;
  name: string;
  playtime: number;
  identifiers: PlayerIdentifiers;
  isStaff: boolean;
  firstSeen: Date;
  lastSeen: Date;
}

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
