import { describe, it, expect, afterEach } from "vitest";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadSchemaCache } from "../src/parser/schema-cache.js";

const TEST_CACHE_PATH = join(tmpdir(), `gql-mcp-test-cache-${Date.now()}.json`);

afterEach(() => {
	try {
		if (existsSync(TEST_CACHE_PATH)) unlinkSync(TEST_CACHE_PATH);
	} catch {}
});

describe("loadSchemaCache", () => {
	it("returns null when cache file does not exist", () => {
		const result = loadSchemaCache(
			"/tmp/nonexistent-cache-abc123.json",
			"https://api.example.com/graphql",
		);
		expect(result).toBeNull();
	});

	it("returns null when cache file is invalid JSON", () => {
		writeFileSync(TEST_CACHE_PATH, "not json", "utf-8");
		const result = loadSchemaCache(
			TEST_CACHE_PATH,
			"https://api.example.com/graphql",
		);
		expect(result).toBeNull();
	});

	it("returns null when endpoint does not match", () => {
		const cacheData = {
			endpoint: "https://other-api.com/graphql",
			timestamp: Date.now(),
			introspection: {},
		};
		writeFileSync(TEST_CACHE_PATH, JSON.stringify(cacheData), "utf-8");
		const result = loadSchemaCache(
			TEST_CACHE_PATH,
			"https://api.example.com/graphql",
		);
		expect(result).toBeNull();
	});

	it("returns null when introspection data is invalid", () => {
		const cacheData = {
			endpoint: "https://api.example.com/graphql",
			timestamp: Date.now(),
			introspection: { bad: "data" },
		};
		writeFileSync(TEST_CACHE_PATH, JSON.stringify(cacheData), "utf-8");
		const result = loadSchemaCache(
			TEST_CACHE_PATH,
			"https://api.example.com/graphql",
		);
		expect(result).toBeNull();
	});
});
