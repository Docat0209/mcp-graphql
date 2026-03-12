export interface McpGraphqlConfig {
	/** GraphQL endpoint URL */
	endpoint: string;
	/** Path to local schema file (SDL format) — alternative to endpoint introspection */
	schema?: string;
	/** Auth configuration */
	auth?: AuthConfig;
	/** Include only these query/mutation names (supports glob patterns) */
	include?: string[];
	/** Exclude these query/mutation names (supports glob patterns) */
	exclude?: string[];
	/** Tool name prefix, e.g. "github" → "github_get_user" */
	prefix?: string;
	/** Request timeout in ms (default: 30000) */
	timeout?: number;
	/** Max retries on 429/5xx (default: 3) */
	maxRetries?: number;
	/** Custom headers injected into every request */
	headers?: Record<string, string>;
	/** Transport: "stdio" | "sse" (default: "stdio") */
	transport?: "stdio" | "sse";
	/** SSE port (default: 3000) */
	port?: number;
	/** Pro: License key */
	licenseKey?: string;
	/** Pro: Smart response handling options */
	response?: {
		maxLength?: number;
		arraySliceSize?: number;
		maxDepth?: number;
	};
}

export type AuthConfig =
	| { type: "bearer"; token: string }
	| { type: "api-key"; name: string; value: string; in: "header" | "query" };

export const DEFAULT_CONFIG = {
	timeout: 30_000,
	maxRetries: 3,
	transport: "stdio" as const,
	port: 3000,
} satisfies Partial<McpGraphqlConfig>;
