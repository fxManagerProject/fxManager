export type DeferralsKickFunc = (reason: string) => void;
export type DeferralsDeferObj = {
	defer: () => void;
	update: (message: string) => void;
	done: (failureReason?: string) => void;
	handover: (data: Record<string, unknown>) => void;
	presentCard: (
		card: string,
		cb: (data: unknown, rawData: string) => void,
	) => void;
};
