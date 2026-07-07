export interface Contributor {
	username: string;
	kofi?: string;
	image?: string | false;
	contributions?: number;
}

export interface ContributorSummary {
	core: Contributor[];
	external: Contributor[];
}
