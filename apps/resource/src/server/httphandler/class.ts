import type { z, ZodType } from 'zod';
import type {
	HttpRequest,
	HttpResponse,
	RawRequest,
	RawResponse,
	Route,
	RouteHandler,
	RouteOptions,
} from '../types';

export class HttpServer {
	private routes: Route[] = [];
	private readonly token: string;
	private readonly tokenHeader: string;

	constructor(token: string, tokenHeader = 'x-resource-token') {
		this.token = token;
		this.tokenHeader = tokenHeader;

		SetHttpHandler(async (rawReq: RawRequest, rawRes: RawResponse) => {
			await this.handleRequest(rawReq, rawRes);
		});
	}

	// region routing

	public get(path: string, handler: RouteHandler<unknown>): this;
	public get<TSchema extends ZodType>(
		path: string,
		options: RouteOptions<TSchema>,
		handler: RouteHandler<z.infer<TSchema>>,
	): this;
	public get<TSchema extends ZodType>(
		path: string,
		optionsOrHandler: RouteOptions<TSchema> | RouteHandler<unknown>,
		handler?: RouteHandler<z.infer<TSchema>>,
	): this {
		return this.addRoute('GET', path, optionsOrHandler, handler);
	}

	public post(path: string, handler: RouteHandler<unknown>): this;
	public post<TSchema extends ZodType>(
		path: string,
		options: RouteOptions<TSchema>,
		handler: RouteHandler<z.infer<TSchema>>,
	): this;
	public post<TSchema extends ZodType>(
		path: string,
		optionsOrHandler: RouteOptions<TSchema> | RouteHandler<unknown>,
		handler?: RouteHandler<z.infer<TSchema>>,
	): this {
		return this.addRoute('POST', path, optionsOrHandler, handler);
	}

	public put(path: string, handler: RouteHandler<unknown>): this;
	public put<TSchema extends ZodType>(
		path: string,
		options: RouteOptions<TSchema>,
		handler: RouteHandler<z.infer<TSchema>>,
	): this;
	public put<TSchema extends ZodType>(
		path: string,
		optionsOrHandler: RouteOptions<TSchema> | RouteHandler<unknown>,
		handler?: RouteHandler<z.infer<TSchema>>,
	): this {
		return this.addRoute('PUT', path, optionsOrHandler, handler);
	}

	public delete(path: string, handler: RouteHandler<unknown>): this;
	public delete<TSchema extends ZodType>(
		path: string,
		options: RouteOptions<TSchema>,
		handler: RouteHandler<z.infer<TSchema>>,
	): this;
	public delete<TSchema extends ZodType>(
		path: string,
		optionsOrHandler: RouteOptions<TSchema> | RouteHandler<unknown>,
		handler?: RouteHandler<z.infer<TSchema>>,
	): this {
		return this.addRoute('DELETE', path, optionsOrHandler, handler);
	}

	public patch(path: string, handler: RouteHandler<unknown>): this;
	public patch<TSchema extends ZodType>(
		path: string,
		options: RouteOptions<TSchema>,
		handler: RouteHandler<z.infer<TSchema>>,
	): this;
	public patch<TSchema extends ZodType>(
		path: string,
		optionsOrHandler: RouteOptions<TSchema> | RouteHandler<unknown>,
		handler?: RouteHandler<z.infer<TSchema>>,
	): this {
		return this.addRoute('PATCH', path, optionsOrHandler, handler);
	}

	private addRoute<TSchema extends ZodType>(
		method: string,
		path: string,
		optionsOrHandler: RouteOptions<TSchema> | RouteHandler<unknown>,
		handler?: RouteHandler<z.infer<TSchema>>,
	): this {
		if (typeof optionsOrHandler === 'function') {
			this.routes.push({
				method: method.toUpperCase(),
				path,
				schema: null,
				handler: optionsOrHandler,
			});
		} else {
			this.routes.push({
				method: method.toUpperCase(),
				path,
				schema: optionsOrHandler.schema,
				handler: handler as RouteHandler<unknown>,
			});
		}

		return this;
	}

	// region core handler

	private async handleRequest(
		rawReq: RawRequest,
		rawRes: RawResponse,
	): Promise<void> {
		const rawBody = await this.readBody(rawReq);

		// Parse JSON body once; keep null for empty bodies
		let parsedBody: unknown = null;
		if (rawBody) {
			try {
				parsedBody = JSON.parse(rawBody);
			} catch {
				return this.sendResponse(rawRes, {
					status: 400,
					body: { success: false, error: 'Malformed JSON body' },
				});
			}
		}

		const req: HttpRequest<unknown> = {
			address: rawReq.address,
			headers: rawReq.headers,
			method: rawReq.method.toUpperCase(),
			path: rawReq.path,
			body: parsedBody,
		};

		// token validation
		if (!this.validateToken(req)) {
			return this.sendResponse(rawRes, {
				status: 401,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ success: false, error: 'Unauthorized' }),
			});
		}

		const route = this.matchRoute(req);

		if (!route) {
			return this.sendResponse(rawRes, {
				status: 404,
				body: { success: false, error: 'Not Found' },
			});
		}

		// Schema validation
		if (route.schema) {
			const result = route.schema.safeParse(parsedBody);

			if (!result.success) {
				const details = result.error.issues
					.map((issue) => `   - [${issue.path.join('.')}] ${issue.message}`)
					.join('\n');

				return this.sendResponse(rawRes, {
					status: 422,
					body: {
						success: false,
						error: 'Validation failed',
						details,
					},
				});
			}

			req.body = result.data;
		}

		try {
			const response = await route.handler(req);
			console.log('resposne to request:', response);
			this.sendResponse(rawRes, response);
		} catch (err) {
			console.error(
				`[HttpServer] Unhandled error on ${req.method} ${req.path}:`,
				err,
			);
			this.sendResponse(rawRes, {
				status: 500,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					success: false,
					error: 'Internal Server Error',
				}),
			});
		}
	}

	// region helpers

	private readBody(rawReq: RawRequest): Promise<string | null> {
		return new Promise((resolve) => {
			rawReq.setCancelHandler(() => resolve(null));

			rawReq.setDataHandler((data: string) => {
				resolve(data);
			});

			setTimeout(() => resolve(null), 5000);
		});
	}

	private validateToken(req: HttpRequest<unknown>): boolean {
		const provided =
			req.headers[this.tokenHeader] ??
			req.headers[this.tokenHeader.toLowerCase()];
		return provided === this.token;
	}

	private matchRoute(req: HttpRequest<unknown>): Route | undefined {
		return this.routes.find(
			(r) => r.method === req.method && r.path === req.path,
		);
	}

	private sendResponse(rawRes: RawResponse, res: HttpResponse): void {
		const body =
			res.body === undefined
				? undefined
				: typeof res.body === 'string'
					? res.body
					: JSON.stringify(res.body);

		rawRes.writeHead(res.status, {
			'Content-Type':
				typeof res.body === 'string' ? 'text/plain' : 'application/json',
			...res.headers,
		});
		rawRes.send(body);
	}
}
