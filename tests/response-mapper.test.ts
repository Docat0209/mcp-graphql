import { describe, it, expect } from "vitest";
import { mapResponse } from "../src/executor/response-mapper.js";

describe("mapResponse", () => {
	it("returns data as formatted JSON", () => {
		const result = mapResponse({
			data: { user: { id: "1", name: "Alice" } },
		});
		expect(result.isError).toBe(false);
		expect(result.content[0].text).toContain('"name": "Alice"');
	});

	it("returns error on GraphQL errors with no data", () => {
		const result = mapResponse({
			errors: [{ message: "Not found" }],
		});
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain("Not found");
	});

	it("includes partial errors with data", () => {
		const result = mapResponse({
			data: { user: { id: "1" } },
			errors: [{ message: "Partial failure" }],
		});
		expect(result.isError).toBe(false);
		expect(result.content[0].text).toContain("Partial failure");
		expect(result.content[0].text).toContain('"id": "1"');
	});

	it("truncates large arrays", () => {
		const bigArray = Array.from({ length: 50 }, (_, i) => ({ id: i }));
		const result = mapResponse(
			{ data: { items: bigArray } },
			{ smartTruncation: { arraySliceSize: 5, maxDepth: 10, maxLength: 100_000 } },
		);
		expect(result.content[0].text).toContain("45 more items");
		expect(result.content[0].text).toContain("50 total");
	});

	it("prunes deep nesting", () => {
		const deep = { a: { b: { c: { d: { e: "deep" } } } } };
		const result = mapResponse(
			{ data: deep },
			{ smartTruncation: { maxDepth: 3, arraySliceSize: 20, maxLength: 100_000 } },
		);
		expect(result.content[0].text).toContain("[Object(");
	});

	it("hard truncates very long text", () => {
		const bigData = { text: "x".repeat(100_000) };
		const result = mapResponse(
			{ data: bigData },
			{ smartTruncation: { maxLength: 1000, arraySliceSize: 20, maxDepth: 10 } },
		);
		expect(result.content[0].text.length).toBeLessThanOrEqual(1100); // some slack for truncation message
		expect(result.content[0].text).toContain("truncated");
	});

	it("handles null data", () => {
		const result = mapResponse({ data: null });
		expect(result.isError).toBe(false);
	});

	it("handles no data field", () => {
		const result = mapResponse({});
		expect(result.content[0].text).toBe("No data returned");
	});
});
