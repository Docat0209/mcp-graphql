import {
	buildClientSchema,
	getIntrospectionQuery,
	type IntrospectionQuery,
	type GraphQLSchema,
	type GraphQLField,
	type GraphQLArgument,
	type GraphQLNamedType,
	isInputObjectType,
	isEnumType,
	isListType,
	isNonNullType,
	isScalarType,
	type GraphQLType,
	type GraphQLInputType,
	type GraphQLOutputType,
} from "graphql";
import { logger } from "../utils/logger.js";

export interface GraphqlField {
	name: string;
	description?: string;
	args: GraphqlArg[];
	returnType: string;
	kind: "query" | "mutation";
}

export interface GraphqlArg {
	name: string;
	type: string;
	required: boolean;
	description?: string;
	enumValues?: string[];
	/** Original GraphQL type name (for variable declarations) */
	graphqlType?: string;
	/** For nested input objects, flattened with underscore separator */
	flattenedFrom?: string;
}

export interface ParsedSchema {
	queries: GraphqlField[];
	mutations: GraphqlField[];
	schemaName: string;
}

/**
 * Fetch schema via introspection query.
 */
export async function introspect(
	endpoint: string,
	headers: Record<string, string> = {},
	timeout = 30_000,
): Promise<GraphQLSchema> {
	const query = getIntrospectionQuery();

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeout);

	try {
		const response = await fetch(endpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...headers,
			},
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

		return buildClientSchema(json.data);
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Extract queries and mutations from a GraphQL schema, flattening input args.
 */
export function extractFields(schema: GraphQLSchema): ParsedSchema {
	const queryType = schema.getQueryType();
	const mutationType = schema.getMutationType();

	const queries: GraphqlField[] = queryType
		? Object.values(queryType.getFields()).map((f) =>
				fieldToGraphqlField(f, "query"),
			)
		: [];

	const mutations: GraphqlField[] = mutationType
		? Object.values(mutationType.getFields()).map((f) =>
				fieldToGraphqlField(f, "mutation"),
			)
		: [];

	const schemaName =
		queryType?.name === "Query"
			? "GraphQL API"
			: queryType?.name ?? "GraphQL API";

	logger.info(
		`Parsed ${queries.length} queries and ${mutations.length} mutations`,
	);

	return { queries, mutations, schemaName };
}

function fieldToGraphqlField(
	field: GraphQLField<unknown, unknown>,
	kind: "query" | "mutation",
): GraphqlField {
	const args = flattenArgs(field.args);
	return {
		name: field.name,
		description: field.description ?? undefined,
		args,
		returnType: typeToString(field.type),
		kind,
	};
}

/**
 * Flatten nested input object args into top-level args with underscore naming.
 */
function flattenArgs(
	args: readonly GraphQLArgument[],
	prefix = "",
	parentGraphqlType = "",
): GraphqlArg[] {
	const result: GraphqlArg[] = [];

	for (const arg of args) {
		const unwrapped = unwrapType(arg.type);
		const fullName = prefix ? `${prefix}_${arg.name}` : arg.name;

		if (isInputObjectType(unwrapped.namedType)) {
			// Recurse into input object fields
			const inputFields = unwrapped.namedType.getFields();
			const nestedArgs: GraphQLArgument[] = Object.values(inputFields).map(
				(f) => ({
					name: f.name,
					description: f.description ?? undefined,
					type: f.type,
					defaultValue: f.defaultValue,
					extensions: {},
					astNode: undefined,
				}),
			) as GraphQLArgument[];
			result.push(
				...flattenArgs(nestedArgs, fullName, unwrapped.namedType.name),
			);
		} else {
			result.push({
				name: fullName,
				type: scalarToJsonType(unwrapped.namedType),
				required: unwrapped.nonNull,
				description: arg.description ?? undefined,
				graphqlType: typeToString(arg.type),
				enumValues: isEnumType(unwrapped.namedType)
					? unwrapped.namedType.getValues().map((v) => v.name)
					: undefined,
				flattenedFrom: prefix || undefined,
			});
		}
	}

	return result;
}

interface UnwrappedType {
	namedType: GraphQLNamedType;
	nonNull: boolean;
	isList: boolean;
}

function unwrapType(type: GraphQLInputType | GraphQLOutputType): UnwrappedType {
	let nonNull = false;
	let isList = false;
	let current: GraphQLType = type;

	if (isNonNullType(current)) {
		nonNull = true;
		current = current.ofType;
	}
	if (isListType(current)) {
		isList = true;
		current = current.ofType;
	}
	if (isNonNullType(current)) {
		current = current.ofType;
	}

	return {
		namedType: current as GraphQLNamedType,
		nonNull,
		isList,
	};
}

function scalarToJsonType(type: GraphQLNamedType): string {
	if (isScalarType(type)) {
		switch (type.name) {
			case "Int":
			case "Float":
				return "number";
			case "Boolean":
				return "boolean";
			case "ID":
			case "String":
			default:
				return "string";
		}
	}
	if (isEnumType(type)) return "string";
	return "string";
}

function typeToString(type: GraphQLType): string {
	if (isNonNullType(type)) return `${typeToString(type.ofType)}!`;
	if (isListType(type)) return `[${typeToString(type.ofType)}]`;
	return (type as GraphQLNamedType).name;
}
