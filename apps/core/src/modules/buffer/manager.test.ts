import { describe, expect, it } from 'bun:test';
import { LogBuffer } from './manager';

describe('LogBuffer', () => {
	it('initializes with an empty history', () => {
		const buffer = new LogBuffer<string>();
		expect(buffer.getHistory()).toEqual([]);
	});

	it('accumulates pushed events', () => {
		const buffer = new LogBuffer<string>();
		buffer.push('first event');
		buffer.push('second event');

		expect(buffer.getHistory()).toEqual(['first event', 'second event']);
	});

	it('works with complex object types', () => {
		interface LogEntry {
			level: string;
			msg: string;
		}
		const buffer = new LogBuffer<LogEntry>();

		const entry1 = { level: 'info', msg: 'Server started' };
		const entry2 = { level: 'error', msg: 'Connection lost' };

		buffer.push(entry1);
		buffer.push(entry2);

		expect(buffer.getHistory()).toEqual([entry1, entry2]);
	});

	it('respects the default size limit of 1000', () => {
		const buffer = new LogBuffer<number>();

		for (let i = 1; i <= 1005; i++) {
			buffer.push(i);
		}

		const history = buffer.getHistory();
		expect(history).toHaveLength(1000);
		expect(history[0]).toBe(6); // The first 5 items (1 to 5) should be shifted out
		expect(history[999]).toBe(1005);
	});

	it('evicts the oldest item (FIFO) when the limit is exceeded', () => {
		const buffer = new LogBuffer<string>(3);

		buffer.push('A');
		buffer.push('B');
		buffer.push('C');
		expect(buffer.getHistory()).toEqual(['A', 'B', 'C']);

		buffer.push('D');
		expect(buffer.getHistory()).toEqual(['B', 'C', 'D']);

		buffer.push('E');
		expect(buffer.getHistory()).toEqual(['C', 'D', 'E']);
	});
});
