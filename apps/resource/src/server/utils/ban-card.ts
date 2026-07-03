import type { BanDataCard } from '@fxmanager/shared/types';

export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function formatDateTime(value: Date | string): string {
	return escapeHtml(new Date(value).toLocaleString());
}

function formatRelative(target: number, now: number): string {
	const diff = target - now;
	if (diff <= 0) return 'expired';

	const minutes = Math.round(diff / 60_000);
	if (minutes < 60) return `in ${minutes} minute${minutes === 1 ? '' : 's'}`;

	const hours = Math.round(minutes / 60);
	if (hours < 24) return `in ${hours} hour${hours === 1 ? '' : 's'}`;

	const days = Math.round(hours / 24);
	return `in ${days} day${days === 1 ? '' : 's'}`;
}

const C = {
	text: '#eceef2',
	muted: '#8b93a1',
	danger: '#ef4452',
	surface: '#15171c',
	raised: '#1b1e25',
	border: '#2b303b',
};

function expiresCell(ban: BanDataCard, now: number): string {
	if (ban.permanent) {
		return `<div style="display:inline-flex;align-items:center;gap:6px;font-size:13.5px;font-weight:600;color:${C.danger};"><span style="width:6px;height:6px;border-radius:50%;background:${C.danger};"></span>Permanent</div>`;
	}

	return `<div style="font-size:13.5px;color:#dfe2e8;">${formatDateTime(ban.expiresAt)}</div><div style="font-size:11.5px;color:${C.muted};margin-top:2px;">${formatRelative(new Date(ban.expiresAt).getTime(), now)}</div>`;
}

/** Builds the styled HTML card shown to a banned player on the FiveM connection screen. */
export function renderBanCard(ban: BanDataCard, now: number = Date.now()): string {
	const reason = escapeHtml(ban.reason?.trim() || 'No reason provided');
	const bannedOn = formatDateTime(ban.createdAt);

	const cell = `background:${C.raised};border:1px solid ${C.border};border-radius:10px;padding:12px 14px;flex:1;`;
	const label = `font-size:10.5px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:${C.muted};margin-bottom:6px;`;

	return `<div style="display:flex;justify-content:center;align-items:center;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;padding:24px;">
  <div style="position:relative;width:100%;max-width:460px;background:${C.surface};border:1px solid ${C.border};border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
    <div style="height:4px;background:linear-gradient(90deg,${C.danger},#b91c2b);"></div>
    <div style="padding:28px 28px 24px;">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;">
        <div style="flex:none;width:46px;height:46px;border-radius:12px;background:rgba(239,68,82,0.12);display:flex;align-items:center;justify-content:center;">
          <div style="position:relative;width:24px;height:24px;">
            <div style="position:absolute;top:0;left:0;width:24px;height:24px;box-sizing:border-box;border:2.5px solid ${C.danger};border-radius:50%;"></div>
            <div style="position:absolute;top:10.75px;left:0;width:24px;height:2.5px;border-radius:2px;background:${C.danger};transform:rotate(45deg);transform-origin:center;"></div>
          </div>
        </div>
        <div>
          <div style="font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:${C.muted};margin-bottom:4px;">Connection refused</div>
          <div style="font-size:21px;font-weight:700;letter-spacing:-0.01em;color:${C.text};line-height:1.15;">You're banned from this server</div>
        </div>
      </div>

      <div style="background:rgba(239,68,82,0.10);border-left:3px solid ${C.danger};border-radius:8px;padding:12px 14px;margin-bottom:18px;">
        <div style="font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#ef8a93;margin-bottom:4px;">Reason</div>
        <div style="font-size:15px;font-weight:500;color:#f4f5f7;line-height:1.4;">${reason}</div>
      </div>

      <div style="display:flex;gap:12px;margin-bottom:22px;">
        <div style="${cell}">
          <div style="${label}">Banned on</div>
          <div style="font-size:13.5px;color:#dfe2e8;">${bannedOn}</div>
        </div>
        <div style="${cell}">
          <div style="${label}">Expires</div>
          ${expiresCell(ban, now)}
        </div>
      </div>

      <div style="padding-top:16px;border-top:1px solid #23272f;font-size:12px;color:${C.muted};line-height:1.4;">
        Believe this is a mistake? Contact the server's staff team to appeal.
      </div>
    </div>
  </div>
</div>`.trim();
}
