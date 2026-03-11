export const UserPermissions = {
  NONE: 0,
  KICK: 1 << 0, // 1
  BAN: 1 << 1, // 2
  WARN: 1 << 2, // 4
  REVOKE_KICK: 1 << 3, // 8
  REVOKE_BAN: 1 << 4, // 16
  REVOKE_WARN: 1 << 5, // 32

  WHITELIST: 1 << 6, // 64
  REVOKE_WHITELIST: 1 << 7, // 128

  VIEW_REPORT: 1 << 8, // 256
  SEND_REPORT: 1 << 9, // 512
  CLOSE_REPORT: 1 << 10, // 1024

  MASTER: 1 << 30, // (1,073,741,824)
} as const;

export type UserPermissions = (typeof UserPermissions)[keyof typeof UserPermissions];

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
