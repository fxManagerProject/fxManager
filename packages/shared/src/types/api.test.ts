import { describe, expect, it } from 'bun:test';
import { ApiError } from './api';

describe('ApiError Unit Tests', () => {
	describe('Constructor Initialization', () => {
		it('should correctly assign message, status, and set the custom error name', () => {
			const message = 'Internal Server Error';
			const status = 500;

			const error = new ApiError(message, status);

			expect(error.message).toBe(message);
			expect(error.status).toBe(status);
			expect(error.name).toBe('ApiError');
			expect(error.data).toBeUndefined();
		});

		it('should properly inherit from the native Error prototype chain', () => {
			const error = new ApiError('Unauthorized', 401);

			expect(error).toBeInstanceOf(Error);
			expect(error).toBeInstanceOf(ApiError);
			expect(error.stack).toBeTypeOf('string');
		});
	});

	describe('Data Payload Handling', () => {
		it('should attach primitive data payloads successfully', () => {
			const error = new ApiError('Bad Request', 400, 'Invalid string payload');

			expect(error.data).toBe('Invalid string payload');
		});

		it('should retain structural type integrity when passed structured object entities', () => {
			interface ValidationErrors {
				fields: Record<string, string>;
			}

			const contextPayload: ValidationErrors = {
				fields: {
					email: 'Email format is invalid',
					password: 'Password is too short',
				},
			};

			const error = new ApiError<ValidationErrors>(
				'Validation Failed',
				422,
				contextPayload,
			);

			expect(error.data).toBeDefined();
			expect(error.data?.fields.email).toBe('Email format is invalid');
			expect(error.data?.fields.password).toBe('Password is too short');
		});
	});
});
