import { describe, expect, it } from 'bun:test';
import { planJournalMigrations } from './journal-plan';

describe('planJournalMigrations()', () => {
	it('reports up-to-date when journal and registry are in lockstep', () => {
		const plan = planJournalMigrations([0, 1, 2, 3], [0, 1, 2, 3]);
		expect(plan.action).toBe('up-to-date');
	});

	it('reports both empty as up-to-date', () => {
		expect(planJournalMigrations([], []).action).toBe('up-to-date');
	});

	it('lists genuinely new journal entries to register', () => {
		const plan = planJournalMigrations([0, 1, 2, 3, 4], [0, 1, 2, 3]);
		expect(plan.action).toBe('register');
		if (plan.action === 'register') {
			expect(plan.pending).toEqual([4]);
		}
	});

	it('errors when the registry is ahead of the journal (drift)', () => {
		const plan = planJournalMigrations([0, 1, 2, 3], [0, 1, 2, 3, 4, 5, 6]);
		expect(plan.action).toBe('error');
		if (plan.action === 'error') {
			expect(plan.orphanRegistryVersions).toEqual([4, 5, 6]);
		}
	});

	it('errors instead of silently dropping a generated entry that collides', () => {
		const plan = planJournalMigrations([0, 1, 2, 3, 4], [0, 1, 2, 3, 4, 5, 6]);
		expect(plan.action).toBe('error');
	});
});
