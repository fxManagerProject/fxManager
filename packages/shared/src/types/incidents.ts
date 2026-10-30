export const INCIDENT_EVENT_KINDS = [
	'console',
	'server',
	'resource',
	'config',
	'performance',
	'disconnect',
	'gap',
] as const;
export type IncidentEventKind = (typeof INCIDENT_EVENT_KINDS)[number];

export interface IncidentEvent {
	id: number;
	ts: number;
	kind: IncidentEventKind;
	summary: string;
	data: Record<string, unknown>;
}

export interface IncidentSummary {
	id: number;
	title: string;
	description: string;
	from: number;
	to: number;
	createdAt: number;
	status: 'open' | 'resolved';
	resolvedAt: number | null;
	eventCount: number;
}

export interface IncidentNote {
	id: number;
	incidentId: number;
	content: string;
	createdAt: number;
}
export interface IncidentDetail extends IncidentSummary {
	evidence: IncidentEvent[];
	notes: IncidentNote[];
}
export interface IncidentPage<T> {
	items: T[];
	nextCursor: number | null;
}
export interface IncidentLimits {
	retentionDays: number;
	maxStorageMB: number;
}
export interface IncidentStorage extends IncidentLimits {
	usedBytes: number;
	oldestEventAt: number | null;
}

export const INCIDENT_DEFAULT_LIMITS: IncidentLimits = {
	retentionDays: 30,
	maxStorageMB: 128,
};
export const INCIDENT_MAX_EVIDENCE = 5000;
export const INCIDENT_MAX_RANGE_MS = 24 * 60 * 60 * 1000;
