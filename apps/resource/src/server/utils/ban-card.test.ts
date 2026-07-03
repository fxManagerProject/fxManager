import { describe, expect, it } from 'bun:test';
import { escapeHtml, renderBanCard } from './ban-card';

const created = new Date('2026-01-01T00:00:00Z');

describe('escapeHtml', () => {
	it('escapes HTML-significant characters', () => {
		expect(escapeHtml(`<b>"x" & 'y'</b>`)).toBe(
			'&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;',
		);
	});
});

describe('renderBanCard', () => {
	it('escapes the ban reason so it cannot break the card', () => {
		const html = renderBanCard({
			reason: '<script>alert(1)</script>',
			permanent: true,
			createdAt: created,
		});

		expect(html).not.toContain('<script>');
		expect(html).toContain('&lt;script&gt;');
	});

	it('marks a permanent ban as Permanent', () => {
		const html = renderBanCard({
			reason: 'Cheating',
			permanent: true,
			createdAt: created,
		});

		expect(html).toContain('Permanent');
		expect(html).toContain('Cheating');
	});

	it('shows a relative expiry for a temporary ban', () => {
		const now = new Date('2026-01-01T00:00:00Z').getTime();
		const html = renderBanCard(
			{
				reason: 'Spam',
				permanent: false,
				createdAt: created,
				expiresAt: new Date('2026-01-03T00:00:00Z'),
			},
			now,
		);

		expect(html).toContain('in 2 days');
	});

	it('falls back when no reason is provided', () => {
		const html = renderBanCard({
			reason: '',
			permanent: true,
			createdAt: created,
		});

		expect(html).toContain('No reason provided');
	});
});
