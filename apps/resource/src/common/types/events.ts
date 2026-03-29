export type DeferralsKickFunc = (reason: string) => void;
export type DeferralsDeferObj = {
  defer: () => void;
  update: (message: string) => {};
  done: (failureReason?: string) => void;
  handover: (data: Record<string, any>) => void;
  presentCard: (card: string, cb: (data: any, rawData: string) => void) => void;
};
