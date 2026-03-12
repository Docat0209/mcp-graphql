import { describe, it, expect } from "vitest";
import { generateTools } from "../src/generator/tool-generator.js";
import type { ParsedSchema } from "../src/parser/introspection.js";

const mockSchema: ParsedSchema = {
	queries: [
		{
			name: "getUser",
			description: "Fetch a user by ID",
			args: [
				{ name: "id", type: "string", required: true, graphqlType: "ID!" },
			],
			returnType: "User",
			kind: "query",
		},
		{
			name: "listUsers",
			description: "List all users",
			args: [
				{ name: "limit", type: "number", required: false, graphqlType: "Int" },
				{ name: "offset", type: "number", required: false, graphqlType: "Int" },
			],
			returnType: "[User]",
			kind: "query",
		},
	],
	mutations: [
		{
			name: "createUser",
			description: "Create a new user",
			args: [
				{
					name: "input_name",
					type: "string",
					required: true,
					flattenedFrom: "input",
					graphqlType: "String!",
				},
				{
					name: "input_email",
					type: "string",
					required: true,
					flattenedFrom: "input",
					graphqlType: "String!",
				},
			],
			returnType: "User!",
			kind: "mutation",
		},
	],
	schemaName: "GraphQL API",
};

describe("generateTools", () => {
	it("generates tools for all fields", () => {
		const tools = generateTools(mockSchema);
		expect(tools).toHaveLength(3);
	});

	it("converts names to snake_case", () => {
		const tools = generateTools(mockSchema);
		expect(tools.map((t) => t.name)).toEqual([
			"get_user",
			"list_users",
			"create_user",
		]);
	});

	it("applies prefix", () => {
		const tools = generateTools(mockSchema, { prefix: "gql" });
		expect(tools[0].name).toBe("gql_get_user");
	});

	it("includes description with GraphQL metadata", () => {
		const tools = generateTools(mockSchema);
		expect(tools[0].description).toContain("Fetch a user by ID");
		expect(tools[0].description).toContain("[GraphQL query: getUser → User]");
	});

	it("builds inputSchema with properties and required", () => {
		const tools = generateTools(mockSchema);
		const getUserTool = tools[0];
		expect(getUserTool.inputSchema.type).toBe("object");
		expect(getUserTool.inputSchema.properties).toHaveProperty("id");
		expect(getUserTool.inputSchema.required).toEqual(["id"]);
	});

	it("handles optional args (no required array entry)", () => {
		const tools = generateTools(mockSchema);
		const listTool = tools[1];
		expect(listTool.inputSchema.required).toBeUndefined();
	});

	it("preserves fieldRef for query building", () => {
		const tools = generateTools(mockSchema);
		expect(tools[0].fieldRef.fieldName).toBe("getUser");
		expect(tools[0].fieldRef.kind).toBe("query");
	});

	it("filters with include", () => {
		const tools = generateTools(mockSchema, { include: ["get*"] });
		expect(tools).toHaveLength(1);
		expect(tools[0].name).toBe("get_user");
	});

	it("filters with exclude", () => {
		const tools = generateTools(mockSchema, { exclude: ["createUser"] });
		expect(tools).toHaveLength(2);
	});

	it("handles flattened args in inputSchema", () => {
		const tools = generateTools(mockSchema);
		const createTool = tools[2];
		expect(createTool.inputSchema.properties).toHaveProperty("input_name");
		expect(createTool.inputSchema.properties).toHaveProperty("input_email");
		expect(createTool.inputSchema.required).toEqual(["input_name", "input_email"]);
	});
});
