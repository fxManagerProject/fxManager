import type { AUDIT_LOG_ACTIONS } from '../constants';

export type AuditLogAction =
	(typeof AUDIT_LOG_ACTIONS)[keyof typeof AUDIT_LOG_ACTIONS][number];
