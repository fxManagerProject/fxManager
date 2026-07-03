/** biome-ignore-all lint/suspicious/noExplicitAny: mocking fastify request/reply shapes */
import { describe, expect, it, mock } from 'bun:test';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { requireLoopback } from './loopback';

const createMockReply = () => {
	const reply: any = {};
	reply.code = mock(() => reply);
	reply.send = mock(() => reply);
	return reply as unknown as FastifyReply;
};

const reqFrom = (remoteAddress: string | undefined) =>
	({ socket: { remoteAddress } }) as unknown as FastifyRequest;

describe('requireLoopback()', () => {
	const loopback = ['127.0.0.1', '127.5.5.5', '::1', '::ffff:127.0.0.1'];
	for (const addr of loopback) {
		it(`passes through a loopback peer (${addr})`, async () => {
			const reply = createMockReply();
			const result = await requireLoopback(reqFrom(addr), reply);

			expect(result).toBeUndefined();
			expect(reply.code).not.toHaveBeenCalled();
			expect(reply.send).not.toHaveBeenCalled();
		});
	}

	const remote = ['10.0.0.5', '192.168.1.20', '::ffff:10.0.0.5', undefined];
	for (const addr of remote) {
		it(`rejects a non-loopback peer with 403 (${addr})`, async () => {
			const reply = createMockReply();
			await requireLoopback(reqFrom(addr), reply);

			expect(reply.code).toHaveBeenCalledWith(403);
			expect(reply.send).toHaveBeenCalledWith({ error: 'Forbidden' });
		});
	}
});
