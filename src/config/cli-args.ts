import { parseArgs } from "node:util";
import type { McpGraphqlConfig, MutationSafetyMode } from "./types.js";

const HELP_TEXT = `
graphql-to-mcp — Turn any GraphQL API into MCP tools

USAGE
  npx graphql-to-mcp <endpoint> [options]

ENDPOINT
  URL of a GraphQL API (must support introspection)

OPTIONS
  --header, -H <name:value>   Add custom header (repeatable)
  --bearer <token>             Bearer token auth
  --api-key <name:value:in>    API key auth (name:value:header or name:value:query)
  --include <pattern>          Include only matching operations (glob, repeatable)
  --exclude <pattern>          Exclude matching operations (glob, repeatable)
  --prefix <name>              Prefix tool names (e.g. "github")
  --transport <stdio|sse>      MCP transport (default: stdio)
  --port <number>              SSE port (default: 3000)
  --timeout <ms>               Request timeout (default: 30000)
  --max-retries <number>       Retry count on 429/5xx (default: 3)
  --schema-cache <path>        Save/load introspection schema cache to file
  --force-refresh              Ignore schema cache and re-introspect
  --mutation-safety <mode>     warn|safe|unrestricted (default: warn)
  --help, -h                   Show this help
  --version, -v                Show version

PRO OPTIONS
  --license-key <key>          Pro license key (or MCP_GRAPHQL_LICENSE_KEY env var)

EXAMPLES
  npx graphql-to-mcp https://api.spacex.land/graphql
  npx graphql-to-mcp https://api.github.com/graphql --bearer ghp_xxx
  npx graphql-to-mcp https://countries.trevorblades.com --include "country*"
  npx graphql-to-mcp https://api.example.com/graphql --schema-cache ./schema.json
  npx graphql-to-mcp https://api.example.com/graphql --mutation-safety safe
`.trim();

const VALID_SAFETY_MODES = new Set(["warn", "safe", "unrestricted"]);

export function parseCliArgs(argv: string[]): McpGraphqlConfig | null {
	const { values, positionals } = parseArgs({
		args: argv,
		allowPositionals: true,
		options: {
			header: { type: "string", short: "H", multiple: true },
			bearer: { type: "string" },
			"api-key": { type: "string" },
			include: { type: "string", multiple: true },
			exclude: { type: "string", multiple: true },
			prefix: { type: "string" },
			transport: { type: "string" },
			port: { type: "string" },
			timeout: { type: "string" },
			"max-retries": { type: "string" },
			"license-key": { type: "string" },
			"schema-cache": { type: "string" },
			"force-refresh": { type: "boolean" },
			"mutation-safety": { type: "string" },
			help: { type: "boolean", short: "h" },
			version: { type: "boolean", short: "v" },
		},
	});

	if (values.version) {
		console.log("graphql-to-mcp v0.2.0");
		return null;
	}

	if (values.help || positionals.length === 0) {
		console.log(HELP_TEXT);
		return null;
	}

	const endpoint = positionals[0];

	// Parse headers
	const headers: Record<string, string> = {};
	if (values.header) {
		for (const h of values.header) {
			const idx = h.indexOf(":");
			if (idx > 0) {
				headers[h.slice(0, idx).trim()] = h.slice(idx + 1).trim();
			}
		}
	}

	// Parse auth
	let auth: McpGraphqlConfig["auth"];
	if (values.bearer) {
		auth = { type: "bearer", token: values.bearer };
	} else if (values["api-key"]) {
		const parts = values["api-key"].split(":");
		if (parts.length >= 3) {
			auth = {
				type: "api-key",
				name: parts[0],
				value: parts[1],
				in: parts[2] as "header" | "query",
			};
		}
	}

	const licenseKey =
		values["license-key"] ?? process.env.MCP_GRAPHQL_LICENSE_KEY;

	// Parse mutation safety mode
	const rawSafety = values["mutation-safety"];
	let mutationSafety: MutationSafetyMode | undefined;
	if (rawSafety) {
		if (!VALID_SAFETY_MODES.has(rawSafety)) {
			console.error(
				`Invalid --mutation-safety value: "${rawSafety}". Must be warn, safe, or unrestricted.`,
			);
			process.exit(1);
		}
		mutationSafety = rawSafety as MutationSafetyMode;
	}

	return {
		endpoint,
		auth,
		headers: Object.keys(headers).length > 0 ? headers : undefined,
		include: values.include,
		exclude: values.exclude,
		prefix: values.prefix,
		transport: (values.transport as "stdio" | "sse") ?? "stdio",
		port: values.port ? Number.parseInt(values.port, 10) : undefined,
		timeout: values.timeout ? Number.parseInt(values.timeout, 10) : undefined,
		maxRetries: values["max-retries"]
			? Number.parseInt(values["max-retries"], 10)
			: undefined,
		licenseKey,
		schemaCache: values["schema-cache"],
		forceRefresh: values["force-refresh"],
		mutationSafety,
	};
}
