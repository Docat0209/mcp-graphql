import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeGraphql } from "../src/executor/http-client.js";

describe("executeGraphql", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("sends POST request with query and variables", async () => {
		const mockResponse = {
			ok: true,
			status: 200,
			json: async () => ({ data: { user: { id: "1" } } }),
		};
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

		const result = await executeGraphql(
			{ query: "query { user { id } }", variables: {} },
			{ endpoint: "https://example.com/graphql" },
		);

		expect(result).toEqual({ data: { user: { id: "1" } } });
		expect(fetch).toHaveBeenCalledWith(
			"https://example.com/graphql",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({
					query: "query { user { id } }",
					variables: {},
				}),
			}),
		);
	});

	it("includes auth headers for bearer token", async () => {
		const mockResponse = {
			ok: true,
			status: 200,
			json: async () => ({ data: {} }),
		};
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

		await executeGraphql(
			{ query: "{ me { id } }", variables: {} },
			{
				endpoint: "https://example.com/graphql",
				auth: { type: "bearer", token: "test-token" },
			},
		);

		expect(fetch).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				headers: expect.objectContaining({
					Authorization: "Bearer test-token",
				}),
			}),
		);
	});

	it("throws on non-retryable HTTP error", async () => {
		const mockResponse = {
			ok: false,
			status: 400,
			statusText: "Bad Request",
		};
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

		await expect(
			executeGraphql(
				{ query: "invalid", variables: {} },
				{ endpoint: "https://example.com/graphql", maxRetries: 0 },
			),
		).rejects.toThrow("HTTP 400");
	});

	it("retries on 429", async () => {
		const failResponse = { ok: false, status: 429, statusText: "Too Many Requests" };
		const okResponse = { ok: true, status: 200, json: async () => ({ data: { ok: true } }) };

		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(failResponse)
			.mockResolvedValueOnce(okResponse);
		vi.stubGlobal("fetch", fetchMock);

		const result = await executeGraphql(
			{ query: "{ ok }", variables: {} },
			{ endpoint: "https://example.com/graphql", maxRetries: 1 },
		);

		expect(result).toEqual({ data: { ok: true } });
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("retries on 500", async () => {
		const failResponse = { ok: false, status: 500, statusText: "Internal Server Error" };
		const okResponse = { ok: true, status: 200, json: async () => ({ data: {} }) };

		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(failResponse)
			.mockResolvedValueOnce(okResponse);
		vi.stubGlobal("fetch", fetchMock);

		const result = await executeGraphql(
			{ query: "{ ok }", variables: {} },
			{ endpoint: "https://example.com/graphql", maxRetries: 1 },
		);

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(result).toEqual({ data: {} });
	});
});
