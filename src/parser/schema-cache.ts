import { readFileSync, writeFileSync } from "node:fs";
import {
	buildClientSchema,
	type IntrospectionQuery,
	type GraphQLSchema,
	getIntrospectionQuery,
} from "graphql";
import { logger } from "../utils/logger.js";

interface SchemaCacheData {
	endpoint: string;
	timestamp: number;
	introspection: IntrospectionQuery;
}

/**
 * Try to load schema from a cache file.
 * Returns null if cache is missing, corrupt, or for a different endpoint.
 */
export function loadSchemaCache(
	cachePath: string,
	endpoint: string,
): GraphQLSchema | null {
	try {
		const raw = readFileSync(cachePath, "utf-8");
		const data: SchemaCacheData = JSON.parse(raw);

		if (data.endpoint !== endpoint) {
			logger.info(
				`Schema cache endpoint mismatch (cached: ${data.endpoint}), re-introspecting`,
			);
			return null;
		}

		const age = Date.now() - data.timestamp;
		const ageStr = formatAge(age);
		logger.info(`Using cached schema from ${cachePath} (age: ${ageStr})`);

		return buildClientSchema(data.introspection);
	} catch {
		return null;
	}
}

/**
 * Save introspection result to a cache file.
 */
export async function saveSchemaCache(
	cachePath: string,
	endpoint: string,
	headers: Record<string, string>,
	timeout: number,
): Promise<GraphQLSchema> {
	const query = getIntrospectionQuery();

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeout);

	try {
		const response = await fetch(endpoint, {
			method: "POST",
			headers: { "Content-Type": "application/json", ...headers },
			body: JSON.stringify({ query }),
			signal: controller.signal,
		});

		if (!response.ok) {
			throw new Error(
				`Introspection failed: HTTP ${response.status} ${response.statusText}`,
			);
		}

		const json = (await response.json()) as { data: IntrospectionQuery };
		if (!json.data) {
			throw new Error("Introspection response missing 'data' field");
		}

		const cacheData: SchemaCacheData = {
			endpoint,
			timestamp: Date.now(),
			introspection: json.data,
		};

		writeFileSync(cachePath, JSON.stringify(cacheData), "utf-8");
		logger.info(`Schema cached to ${cachePath}`);

		return buildClientSchema(json.data);
	} finally {
		clearTimeout(timer);
	}
}

function formatAge(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
	if (hours < 24) {
		return remainingMinutes > 0 ? `${hours}h${remainingMinutes}m` : `${hours}h`;
	}
	const days = Math.floor(hours / 24);
	return `${days}d`;
}
