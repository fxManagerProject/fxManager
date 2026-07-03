export interface ManagedConvar {
	line: number;
	key: 'onesync' | 'resource-api-token' | 'api-port' | 'fxmanager-resource';
}

export interface CfgFileNode {
	path: string;
	depth: number;
	exists: boolean;
	restartNeeded: boolean;
}

export interface CfgGraph {
	files: CfgFileNode[];
	serverRunning: boolean;
}

export interface CfgFileContent {
	path: string;
	content: string;
	exists: boolean;
	managed: ManagedConvar[];
}

export interface SaveCfgRequest {
	path: string;
	content: string;
	restart?: boolean;
}

export interface SaveCfgResult {
	path: string;
	restarted: boolean;
}

export interface CreateCfgRequest {
	path: string;
}

export interface CreateCfgResult {
	path: string;
}
