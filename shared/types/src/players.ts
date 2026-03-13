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
