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

export type HttpRequest = {
  address: string;
  headers: Record<string, string>;
  method: string;
  path: string;
  body: string | null;
};

export type HttpResponse = {
  status: number;
  headers: Record<string, string | string[]>;
  body?: string;
};

export type RouteHandler = (req: HttpRequest) => Promise<HttpResponse> | HttpResponse;

export type Route = {
  method: string;
  path: string;
  handler: RouteHandler;
};
