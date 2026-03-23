# graphql-to-mcp

[![npm version](https://img.shields.io/npm/v/graphql-to-mcp)](https://www.npmjs.com/package/graphql-to-mcp)
[![npm downloads](https://img.shields.io/npm/dm/graphql-to-mcp)](https://www.npmjs.com/package/graphql-to-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Turn any GraphQL API into MCP tools — zero config, zero code.

Point `graphql-to-mcp` at a GraphQL endpoint and it auto-generates one MCP tool per query/mutation via introspection. Works with Claude Desktop, Cursor, Windsurf, and any MCP client.

## Quick Start

**Try it now** — no install needed:

```bash
npx graphql-to-mcp https://countries.trevorblades.com/graphql
```

Or add to Claude Desktop / Cursor config:

```json
{
  "mcpServers": {
    "countries": {
      "command": "npx",
      "args": ["-y", "graphql-to-mcp", "https://countries.trevorblades.com/graphql"]
    }
  }
}
```

That's it. Claude can now query countries, continents, and languages.

## Features

- **Zero config** — just provide a GraphQL endpoint URL
- **Auto-introspection** — discovers all queries and mutations automatically
- **Flat parameter schemas** — nested `input` objects are flattened for better LLM accuracy
- **Smart truncation** — large responses are intelligently pruned (array slicing + depth limiting)
- **Auth support** — Bearer tokens, API keys (header or query)
- **Retry logic** — automatic retries on 429/5xx with exponential backoff
- **Include/exclude filters** — expose only the operations you want
- **Schema caching** — skip re-introspection with `--schema-cache` for faster startup
- **Mutation safety** — auto-detect destructive mutations (`delete*`, `remove*`, etc.) and warn or block them

## Usage

### CLI

```bash
# Public API (no auth)
npx graphql-to-mcp https://countries.trevorblades.com/graphql

# With bearer token
npx graphql-to-mcp https://api.github.com/graphql --bearer ghp_xxxxx

# With API key
npx graphql-to-mcp https://api.example.com/graphql --api-key "X-API-Key:your-key:header"

# Filter operations
npx graphql-to-mcp https://api.example.com/graphql --include "get*" --exclude "internal*"

# With prefix (avoid name collisions when using multiple APIs)
npx graphql-to-mcp https://api.example.com/graphql --prefix myapi

# Cache schema locally for faster restarts
npx graphql-to-mcp https://api.example.com/graphql --schema-cache ./schema.json

# Force re-introspection (ignore cache)
npx graphql-to-mcp https://api.example.com/graphql --schema-cache ./schema.json --force-refresh

# Block destructive mutations (delete*, remove*, etc.)
npx graphql-to-mcp https://api.example.com/graphql --mutation-safety safe
```

### Claude Desktop / Cursor Config

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": [
        "-y", "graphql-to-mcp",
        "https://api.github.com/graphql",
        "--bearer", "ghp_xxxxx",
        "--prefix", "github"
      ]
    }
  }
}
```

### Programmatic

```typescript
import { createServer } from "graphql-to-mcp";

const server = await createServer({
  endpoint: "https://api.example.com/graphql",
  auth: { type: "bearer", token: "xxx" },
  include: ["getUser", "listUsers"],
});
```

## How It Works

1. **Introspect** — Fetches the GraphQL schema via introspection query
2. **Flatten** — Nested `InputObject` types are flattened into simple key-value parameters (e.g., `input.name` → `input_name`)
3. **Generate** — Each query/mutation becomes an MCP tool with a flat JSON Schema
4. **Execute** — When an LLM calls a tool, the flat args are reconstructed into proper GraphQL variables and sent to your endpoint

### Why Flat Schemas?

LLMs are significantly better at filling flat key-value parameters than deeply nested JSON objects. By flattening `InputObject` types, we get:

- Higher accuracy in parameter filling
- Fewer hallucinated nested structures
- Better compatibility across different LLM providers

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--bearer <token>` | Bearer token auth | — |
| `--api-key <name:value:in>` | API key auth | — |
| `-H, --header <name:value>` | Custom header (repeatable) | — |
| `--include <pattern>` | Include only matching operations | all |
| `--exclude <pattern>` | Exclude matching operations | none |
| `--prefix <name>` | Tool name prefix | — |
| `--timeout <ms>` | Request timeout | 30000 |
| `--max-retries <n>` | Retry on 429/5xx | 3 |
| `--transport <stdio\|sse>` | MCP transport | stdio |
| `--schema-cache <path>` | Save/load introspection cache | — |
| `--force-refresh` | Ignore cache, re-introspect | false |
| `--mutation-safety <mode>` | `warn` \| `safe` \| `unrestricted` | warn |

## Smart Truncation

GraphQL APIs can return large payloads that overwhelm LLM context windows. `graphql-to-mcp` automatically:

- **Slices arrays** to 20 items (with metadata showing total count)
- **Prunes depth** beyond 5 levels (with object/array summaries)
- **Hard truncates** at 50K characters as a safety net

## Schema Caching

Introspection queries can be slow on large schemas. Use `--schema-cache` to save the introspection result locally:

```bash
# First run: introspects and saves to cache
npx graphql-to-mcp https://api.example.com/graphql --schema-cache ./schema.json

# Subsequent runs: loads from cache (instant startup)
npx graphql-to-mcp https://api.example.com/graphql --schema-cache ./schema.json

# Force re-introspection when the API schema changes
npx graphql-to-mcp https://api.example.com/graphql --schema-cache ./schema.json --force-refresh
```

The cache file stores the endpoint URL and timestamp. If you point at a different endpoint, it automatically re-introspects.

## Mutation Safety

By default, `graphql-to-mcp` detects destructive mutations and adds warnings to their descriptions. This helps LLMs understand the risk before executing them.

Detected patterns: `delete*`, `remove*`, `drop*`, `clear*`, `truncate*`, `destroy*`, `purge*`, `reset*` (case-insensitive).

| Mode | Behavior |
|------|----------|
| `warn` (default) | Adds "DESTRUCTIVE:" prefix to dangerous mutation descriptions |
| `safe` | Completely excludes dangerous mutations from the tool list |
| `unrestricted` | No filtering or warnings (previous behavior) |

```bash
# Safe mode: only expose read queries + non-destructive mutations
npx graphql-to-mcp https://api.example.com/graphql --mutation-safety safe

# Unrestricted: expose everything (use with caution)
npx graphql-to-mcp https://api.example.com/graphql --mutation-safety unrestricted
```

## Use with REST APIs Too

Pair with [mcp-openapi](https://www.npmjs.com/package/mcp-openapi) to give Claude access to both REST and GraphQL APIs:

```json
{
  "mcpServers": {
    "github-graphql": {
      "command": "npx",
      "args": ["-y", "graphql-to-mcp", "https://api.github.com/graphql", "--bearer", "ghp_xxx", "--prefix", "gh"]
    },
    "petstore-rest": {
      "command": "npx",
      "args": ["-y", "mcp-openapi", "https://petstore3.swagger.io/api/v3/openapi.json"]
    }
  }
}
```

## Related

- [mcp-openapi](https://www.npmjs.com/package/mcp-openapi) — Same zero-config approach for REST/OpenAPI APIs

## License

MIT
