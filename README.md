# mcp-graphql

Turn any GraphQL API into MCP tools — zero config, zero code.

Point `mcp-graphql` at a GraphQL endpoint and it auto-generates one MCP tool per query/mutation via introspection. Works with Claude Desktop, Cursor, Windsurf, and any MCP client.

## Quick Start

```json
{
  "mcpServers": {
    "my-api": {
      "command": "npx",
      "args": ["-y", "mcp-graphql", "https://countries.trevorblades.com/graphql"]
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

## Usage

### CLI

```bash
# Public API (no auth)
npx mcp-graphql https://countries.trevorblades.com/graphql

# With bearer token
npx mcp-graphql https://api.github.com/graphql --bearer ghp_xxxxx

# With API key
npx mcp-graphql https://api.example.com/graphql --api-key "X-API-Key:your-key:header"

# Filter operations
npx mcp-graphql https://api.example.com/graphql --include "get*" --exclude "internal*"

# With prefix (avoid name collisions when using multiple APIs)
npx mcp-graphql https://api.example.com/graphql --prefix myapi
```

### Claude Desktop / Cursor Config

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": [
        "-y", "mcp-graphql",
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
import { createServer } from "mcp-graphql";

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

## Smart Truncation

GraphQL APIs can return large payloads that overwhelm LLM context windows. `mcp-graphql` automatically:

- **Slices arrays** to 20 items (with metadata showing total count)
- **Prunes depth** beyond 5 levels (with object/array summaries)
- **Hard truncates** at 50K characters as a safety net

## Related

- [mcp-openapi](https://www.npmjs.com/package/mcp-openapi) — Same zero-config approach for REST/OpenAPI APIs

## License

MIT
