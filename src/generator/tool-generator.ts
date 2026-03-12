import type { GraphqlField, GraphqlArg, ParsedSchema } from "../parser/introspection.js";
import { logger } from "../utils/logger.js";

export interface JsonSchema {
	type: string;
	properties?: Record<string, unknown>;
	required?: string[];
}

export interface GeneratedTool {
	name: string;
	description: string;
	inputSchema: JsonSchema;
	fieldRef: {
		fieldName: string;
		kind: "query" | "mutation";
		args: GraphqlArg[];
	};
}

export interface GenerateOptions {
	prefix?: string;
	include?: string[];
	exclude?: string[];
}

export function generateTools(
	schema: ParsedSchema,
	options: GenerateOptions = {},
): GeneratedTool[] {
	let fields = [...schema.queries, ...schema.mutations];

	if (options.include?.length) {
		fields = fields.filter((f) =>
			options.include!.some((p) => matchPattern(f.name, p)),
		);
	}

	if (options.exclude?.length) {
		fields = fields.filter(
			(f) => !options.exclude!.some((p) => matchPattern(f.name, p)),
		);
	}

	const tools = fields.map((field) => fieldToTool(field, options.prefix));

	logger.info(`Generated ${tools.length} MCP tools`);
	return tools;
}

function fieldToTool(field: GraphqlField, prefix?: string): GeneratedTool {
	const name = prefix
		? `${prefix}_${toSnakeCase(field.name)}`
		: toSnakeCase(field.name);

	const properties: Record<string, unknown> = {};
	const required: string[] = [];

	for (const arg of field.args) {
		const prop: Record<string, unknown> = { type: arg.type };
		if (arg.description) prop.description = arg.description;
		if (arg.enumValues) prop.enum = arg.enumValues;
		properties[arg.name] = prop;
		if (arg.required) required.push(arg.name);
	}

	const description = buildDescription(field);

	return {
		name,
		description,
		inputSchema: {
			type: "object",
			properties,
			...(required.length > 0 ? { required } : {}),
		},
		fieldRef: {
			fieldName: field.name,
			kind: field.kind,
			args: field.args,
		},
	};
}

function buildDescription(field: GraphqlField): string {
	const parts: string[] = [];
	if (field.description) {
		parts.push(
			field.description.length > 200
				? `${field.description.slice(0, 200)}...`
				: field.description,
		);
	}
	parts.push(
		`[GraphQL ${field.kind}: ${field.name} → ${field.returnType}]`,
	);
	return parts.join(" ");
}

function toSnakeCase(name: string): string {
	return name
		.replace(/([a-z])([A-Z])/g, "$1_$2")
		.replace(/[^a-zA-Z0-9]/g, "_")
		.toLowerCase()
		.replace(/_+/g, "_")
		.replace(/^_|_$/g, "");
}

function matchPattern(value: string, pattern: string): boolean {
	if (pattern.includes("*")) {
		const regex = new RegExp(
			`^${pattern.replace(/\*/g, ".*")}$`,
		);
		return regex.test(value);
	}
	return value === pattern;
}
