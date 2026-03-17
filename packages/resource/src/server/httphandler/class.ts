import { HttpRequest, HttpResponse, RawRequest, RawResponse, Route, RouteHandler } from '../types';

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

  get(path: string, handler: RouteHandler): this {
    return this.addRoute('GET', path, handler);
  }

  post(path: string, handler: RouteHandler): this {
    return this.addRoute('POST', path, handler);
  }

  put(path: string, handler: RouteHandler): this {
    return this.addRoute('PUT', path, handler);
  }

  delete(path: string, handler: RouteHandler): this {
    return this.addRoute('DELETE', path, handler);
  }

  patch(path: string, handler: RouteHandler): this {
    return this.addRoute('PATCH', path, handler);
  }

  private addRoute(method: string, path: string, handler: RouteHandler): this {
    this.routes.push({ method: method.toUpperCase(), path, handler });
    return this;
  }

  // region core

  private async handleRequest(rawReq: RawRequest, rawRes: RawResponse): Promise<void> {
    const body = await this.readBody(rawReq);

    const req: HttpRequest = {
      address: rawReq.address,
      headers: rawReq.headers,
      method: rawReq.method.toUpperCase(),
      path: rawReq.path,
      body,
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Not Found' }),
      });
    }

    try {
      const response = await route.handler(req);
      this.sendResponse(rawRes, response);
    } catch (err) {
      console.error(`[HttpServer] Unhandled error on ${req.method} ${req.path}:`, err);
      this.sendResponse(rawRes, {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Internal Server Error' }),
      });
    }
  }

  private readBody(rawReq: RawRequest): Promise<string | null> {
    return new Promise((resolve) => {
      let body = '';

      rawReq.setCancelHandler(() => resolve(null));

      rawReq.setDataHandler((data: string) => {
        body += data;

        // setDataHandler is called once per chunk; resolve when it's done
        resolve(body || null);
      });
    });
  }

  private validateToken(req: HttpRequest): boolean {
    const provided = req.headers[this.tokenHeader] ?? req.headers[this.tokenHeader.toLowerCase()];
    return provided === this.token;
  }

  private matchRoute(req: HttpRequest): Route | undefined {
    return this.routes.find((r) => r.method === req.method && r.path === req.path);
  }

  private sendResponse(rawRes: RawResponse, res: HttpResponse): void {
    rawRes.writeHead(res.status, {
      'Content-Type': 'application/json',
      ...res.headers,
    });
    rawRes.send(res.body);
  }
}
