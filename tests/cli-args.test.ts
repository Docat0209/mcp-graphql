import { describe, it, expect } from "vitest";
import { parseCliArgs } from "../src/config/cli-args.js";

describe("parseCliArgs", () => {
	it("parses endpoint from positional arg", () => {
		const config = parseCliArgs(["https://api.example.com/graphql"]);
		expect(config?.endpoint).toBe("https://api.example.com/graphql");
	});

	it("returns null for --help", () => {
		const config = parseCliArgs(["--help"]);
		expect(config).toBeNull();
	});

	it("returns null for --version", () => {
		const config = parseCliArgs(["--version"]);
		expect(config).toBeNull();
	});

	it("returns null when no endpoint provided", () => {
		const config = parseCliArgs([]);
		expect(config).toBeNull();
	});

	it("parses bearer auth", () => {
		const config = parseCliArgs([
			"https://api.example.com/graphql",
			"--bearer",
			"my-token",
		]);
		expect(config?.auth).toEqual({ type: "bearer", token: "my-token" });
	});

	it("parses headers", () => {
		const config = parseCliArgs([
			"https://api.example.com/graphql",
			"-H",
			"X-Custom:value123",
		]);
		expect(config?.headers).toEqual({ "X-Custom": "value123" });
	});

	it("parses include/exclude patterns", () => {
		const config = parseCliArgs([
			"https://api.example.com/graphql",
			"--include",
			"get*",
			"--exclude",
			"internal*",
		]);
		expect(config?.include).toEqual(["get*"]);
		expect(config?.exclude).toEqual(["internal*"]);
	});

	it("parses prefix", () => {
		const config = parseCliArgs([
			"https://api.example.com/graphql",
			"--prefix",
			"github",
		]);
		expect(config?.prefix).toBe("github");
	});

	it("parses api-key auth", () => {
		const config = parseCliArgs([
			"https://api.example.com/graphql",
			"--api-key",
			"X-API-Key:secret:header",
		]);
		expect(config?.auth).toEqual({
			type: "api-key",
			name: "X-API-Key",
			value: "secret",
			in: "header",
		});
	});
});
