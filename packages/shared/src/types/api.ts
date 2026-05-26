export type ApiResponse<T = unknown> =
	| {
			success: true;
			data: T;
	  }
	| {
			success: false;
			error: string;
	  };

export interface PaginatedResponse<T> {
	items: T[];
	total: number;
	page: number;
	pageSize: number;
}

export class ApiError<T = unknown> extends Error {
	status: number;
	data?: T;

	constructor(message: string, status: number, data?: T) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
		this.data = data;
	}
}
