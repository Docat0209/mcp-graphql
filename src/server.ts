import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { McpGraphqlConfig } from "./config/types.js";
import { DEFAULT_CONFIG } from "./config/types.js";
import { introspect, extractFields } from "./parser/introspection.js";
import {
	loadSchemaCache,
	saveSchemaCache,
} from "./parser/schema-cache.js";
import { generateTools, type GeneratedTool } from "./generator/tool-generator.js";
import { applyMutationSafety } from "./generator/mutation-safety.js";
import { buildQuery } from "./executor/query-builder.js";
import { executeGraphql } from "./executor/http-client.js";
import { mapResponse } from "./executor/response-mapper.js";
import { logger } from "./utils/logger.js";

export async function createServer(
	config: McpGraphqlConfig,
): Promise<Server> {
	const cfg = { ...DEFAULT_CONFIG, ...config };

	// Build request headers (for both introspection and execution)
	const requestHeaders: Record<string, string> = { ...cfg.headers };
	if (cfg.auth) {
		switch (cfg.auth.type) {
			case "bearer":
				requestHeaders.Authorization = `Bearer ${cfg.auth.token}`;
				break;
			case "api-key":
				if (cfg.auth.in === "header") {
					requestHeaders[cfg.auth.name] = cfg.auth.value;
				}
				break;
		}
	}

	// Introspect schema (with optional caching)
	let schema;
	if (cfg.schemaCache && !cfg.forceRefresh) {
		schema = loadSchemaCache(cfg.schemaCache, cfg.endpoint);
	}
	if (!schema) {
		if (cfg.forceRefresh && cfg.schemaCache) {
			logger.info(`Force refresh: ignoring cache, re-introspecting ${cfg.endpoint}...`);
		} else {
			logger.info(`Introspecting ${cfg.endpoint}...`);
		}
		if (cfg.schemaCache) {
			schema = await saveSchemaCache(
				cfg.schemaCache,
				cfg.endpoint,
				requestHeaders,
				cfg.timeout,
			);
		} else {
			schema = await introspect(cfg.endpoint, requestHeaders, cfg.timeout);
		}
	}

	const parsed = extractFields(schema);

	// Generate tools
	let tools = generateTools(parsed, {
		prefix: cfg.prefix,
		include: cfg.include,
		exclude: cfg.exclude,
	});

	// Apply mutation safety
	tools = applyMutationSafety(tools, cfg.mutationSafety);

	// Build tool lookup
	const toolMap = new Map<string, GeneratedTool>();
	for (const tool of tools) {
		toolMap.set(tool.name, tool);
	}

	logger.info(
		`Ready: ${tools.length} tools from ${parsed.schemaName}`,
	);

	// Create MCP server
	const server = new Server(
		{
			name: cfg.prefix ? `mcp-graphql-${cfg.prefix}` : "mcp-graphql",
			version: "0.2.0",
		},
		{
			capabilities: { tools: {} },
		},
	);

	// List tools handler
	server.setRequestHandler(ListToolsRequestSchema, async () => ({
		tools: tools.map((t) => ({
			name: t.name,
			description: t.description,
			inputSchema: t.inputSchema,
		})),
	}));

	// Call tool handler
	server.setRequestHandler(CallToolRequestSchema, async (request) => {
		const { name, arguments: args = {} } = request.params;

		const tool = toolMap.get(name);
		if (!tool) {
			return {
				content: [{ type: "text", text: `Unknown tool: ${name}` }],
				isError: true,
			};
		}

		try {
			// Build GraphQL query from flat args
			const { query, variables } = buildQuery(
				tool.fieldRef.fieldName,
				tool.fieldRef.kind,
				tool.fieldRef.args,
				args as Record<string, unknown>,
			);

			logger.info(`Executing ${tool.fieldRef.kind} ${tool.fieldRef.fieldName}`);

			// Execute
			const response = await executeGraphql(
				{ query, variables },
				{
					endpoint: cfg.endpoint,
					headers: cfg.headers,
					auth: cfg.auth,
					timeout: cfg.timeout,
					maxRetries: cfg.maxRetries,
				},
			);

			// Map response
			return mapResponse(response, {
				smartTruncation: cfg.response,
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			logger.error(`Tool ${name} failed: ${message}`);
			return {
				content: [{ type: "text", text: `Error: ${message}` }],
				isError: true,
			};
		}
	});

	return server;
}

export async function startServer(config: McpGraphqlConfig): Promise<void> {
	const server = await createServer(config);

	if (config.transport === "sse") {
		logger.warn("SSE transport not yet implemented, falling back to stdio");
	}

	const transport = new StdioServerTransport();
	await server.connect(transport);
	logger.info("MCP server running on stdio");
}
