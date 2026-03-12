import type { GraphqlResponse } from "./http-client.js";

const FREE_TRUNCATION_DEFAULTS = {
	maxLength: 50_000,
	arraySliceSize: 20,
	maxDepth: 5,
};

export interface SmartTruncationOptions {
	maxLength?: number;
	arraySliceSize?: number;
	maxDepth?: number;
}

export interface MapResponseOptions {
	smartTruncation?: SmartTruncationOptions;
}

export function mapResponse(
	response: GraphqlResponse,
	options: MapResponseOptions = {},
): { content: Array<{ type: "text"; text: string }>; isError: boolean } {
	// Handle GraphQL errors
	if (response.errors?.length && !response.data) {
		const errorText = response.errors
			.map((e) => e.message)
			.join("\n");
		return {
			content: [{ type: "text", text: `GraphQL Error:\n${errorText}` }],
			isError: true,
		};
	}

	// Partial errors — include both data and errors
	let text: string;
	if (response.data !== undefined) {
		const truncOpts = {
			...FREE_TRUNCATION_DEFAULTS,
			...options.smartTruncation,
		};
		const truncated = smartTruncate(response.data, truncOpts);
		text = JSON.stringify(truncated, null, 2);

		if (response.errors?.length) {
			const warnings = response.errors.map((e) => e.message).join("; ");
			text = `⚠ Partial errors: ${warnings}\n\n${text}`;
		}
	} else {
		text = "No data returned";
	}

	// Hard truncate safety net
	const maxLen = options.smartTruncation?.maxLength ?? FREE_TRUNCATION_DEFAULTS.maxLength;
	if (text.length > maxLen) {
		text = `${text.slice(0, maxLen)}\n\n… [truncated at ${maxLen} chars]`;
	}

	return {
		content: [{ type: "text", text }],
		isError: false,
	};
}

function smartTruncate(
	data: unknown,
	opts: Required<SmartTruncationOptions>,
	depth = 0,
): unknown {
	if (data === null || data === undefined) return data;

	if (depth >= opts.maxDepth) {
		if (Array.isArray(data)) {
			return `[Array(${data.length})]`;
		}
		if (typeof data === "object") {
			return `[Object(${Object.keys(data).length} keys)]`;
		}
		return data;
	}

	if (Array.isArray(data)) {
		const sliced = data.slice(0, opts.arraySliceSize);
		const items = sliced.map((item) => smartTruncate(item, opts, depth + 1));
		if (data.length > opts.arraySliceSize) {
			return [
				...items,
				{ _meta: `… ${data.length - opts.arraySliceSize} more items (${data.length} total)` },
			];
		}
		return items;
	}

	if (typeof data === "object") {
		const result: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
			result[key] = smartTruncate(value, opts, depth + 1);
		}
		return result;
	}

	return data;
}
