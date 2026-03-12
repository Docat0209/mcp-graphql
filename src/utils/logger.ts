export const logger = {
	info: (msg: string) => console.error(`[mcp-graphql] ${msg}`),
	warn: (msg: string) => console.error(`[mcp-graphql] WARN: ${msg}`),
	error: (msg: string) => console.error(`[mcp-graphql] ERROR: ${msg}`),
};
