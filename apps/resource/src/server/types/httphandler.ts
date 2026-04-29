import type { ZodType } from 'zod';

export type RawRequest = {
	address: string;
	headers: Record<string, string>;
	method: string;
	path: string;
	setDataHandler(handler: (data: string) => void): void;
	setDataHandler(handler: (data: ArrayBuffer) => void, binary: 'binary'): void;
	setCancelHandler(handler: () => void): void;
};

export type RawResponse = {
	writeHead(code: number, headers?: Record<string, string | string[]>): void;
	write(data: string): void;
	send(data?: string): void;
};

export type HttpRequest<TBody = unknown> = {
	address: string;
	headers: Record<string, string>;
	method: string;
	path: string;
	body: TBody;
};

export type HttpResponse = {
	status: number;
	headers?: Record<string, string | string[]>;
	body?: string | object;
};

export type RouteHandler<TBody> = (
	req: HttpRequest<TBody>,
) => Promise<HttpResponse> | HttpResponse;

export type Route = {
	method: string;
	path: string;
	schema: ZodType | null;
	handler: RouteHandler<unknown>;
};

export type RouteOptions<TSchema extends ZodType> = {
	schema: TSchema;
};
