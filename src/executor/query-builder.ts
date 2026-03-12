import type { GraphqlArg } from "../parser/introspection.js";

/**
 * Build a GraphQL query/mutation string from flat tool-call args.
 * Reconstructs nested input objects from flattened arg names.
 */
export function buildQuery(
	fieldName: string,
	kind: "query" | "mutation",
	args: GraphqlArg[],
	values: Record<string, unknown>,
): { query: string; variables: Record<string, unknown> } {
	// Reconstruct nested variables from flat args
	const variables: Record<string, unknown> = {};

	for (const arg of args) {
		if (!(arg.name in values)) continue;

		if (arg.flattenedFrom) {
			// Reconstruct nested path
			const parts = arg.name.split("_");
			setNested(variables, parts, values[arg.name]);
		} else {
			variables[arg.name] = values[arg.name];
		}
	}

	// Build variable declarations for the operation
	const varDecls = buildVariableDeclarations(args, values);
	const argList = buildArgList(args, values);

	const opType = kind === "query" ? "query" : "mutation";
	const opName = `${fieldName.charAt(0).toUpperCase()}${fieldName.slice(1)}Op`;

	let query: string;
	if (varDecls.length > 0) {
		query = `${opType} ${opName}(${varDecls.join(", ")}) {\n  ${fieldName}(${argList.join(", ")})\n}`;
	} else {
		query = `${opType} ${opName} {\n  ${fieldName}\n}`;
	}

	return { query, variables };
}

function buildVariableDeclarations(
	args: GraphqlArg[],
	values: Record<string, unknown>,
): string[] {
	const decls: string[] = [];
	const seen = new Set<string>();

	for (const arg of args) {
		if (!(arg.name in values)) continue;

		// Use the root arg name for variable declaration
		const rootName = arg.flattenedFrom
			? arg.name.split("_")[0]
			: arg.name;

		if (seen.has(rootName)) continue;
		seen.add(rootName);

		// Use the original GraphQL type if available, otherwise infer
		const gqlType = arg.flattenedFrom
			? inferRootGraphqlType(args, rootName)
			: (arg.graphqlType ?? jsonTypeToGraphql(arg));

		decls.push(`$${rootName}: ${gqlType}`);
	}

	return decls;
}

function inferRootGraphqlType(args: GraphqlArg[], rootName: string): string {
	// Find the first arg that belongs to this root to get the parent type info
	for (const arg of args) {
		if (arg.flattenedFrom === rootName && arg.graphqlType) {
			// The flattenedFrom tells us the parent input type
			// We need the root arg's original GraphQL type
			break;
		}
	}
	// Fallback: use the flattenedFrom as the input type name + "Input"
	return `${rootName.charAt(0).toUpperCase()}${rootName.slice(1)}Input`;
}

function buildArgList(
	args: GraphqlArg[],
	values: Record<string, unknown>,
): string[] {
	const argMap: string[] = [];
	const seen = new Set<string>();

	for (const arg of args) {
		if (!(arg.name in values)) continue;

		const rootName = arg.flattenedFrom
			? arg.name.split("_")[0]
			: arg.name;

		if (seen.has(rootName)) continue;
		seen.add(rootName);
		argMap.push(`${rootName}: $${rootName}`);
	}

	return argMap;
}

function jsonTypeToGraphql(arg: GraphqlArg): string {
	if (arg.graphqlType) return arg.graphqlType;

	let base: string;
	switch (arg.type) {
		case "number":
			base = "Int";
			break;
		case "boolean":
			base = "Boolean";
			break;
		case "string":
		default:
			base = "String";
			break;
	}
	return arg.required ? `${base}!` : base;
}

function setNested(
	obj: Record<string, unknown>,
	parts: string[],
	value: unknown,
): void {
	let current = obj;
	for (let i = 0; i < parts.length - 1; i++) {
		if (!(parts[i] in current) || typeof current[parts[i]] !== "object") {
			current[parts[i]] = {};
		}
		current = current[parts[i]] as Record<string, unknown>;
	}
	current[parts[parts.length - 1]] = value;
}
