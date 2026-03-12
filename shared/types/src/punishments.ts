export interface Ban {
  id: number;
  playerId: number;
  reason: string;
  bannedBy: string;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface CreateBanInput {
  license: string;
  reason: string;
  bannedBy: string;
  expiresAt?: Date;
}
