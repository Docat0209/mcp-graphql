import { describe, it, expect } from "vitest";
import { buildQuery } from "../src/executor/query-builder.js";
import type { GraphqlArg } from "../src/parser/introspection.js";

describe("buildQuery", () => {
	it("builds a simple query with no args", () => {
		const { query, variables } = buildQuery("users", "query", [], {});
		expect(query).toContain("query UsersOp");
		expect(query).toContain("users");
		expect(variables).toEqual({});
	});

	it("builds query with scalar args", () => {
		const args: GraphqlArg[] = [
			{ name: "id", type: "string", required: true, graphqlType: "ID!" },
		];
		const { query, variables } = buildQuery("getUser", "query", args, {
			id: "123",
		});
		expect(query).toContain("$id: ID!");
		expect(query).toContain("id: $id");
		expect(variables).toEqual({ id: "123" });
	});

	it("builds mutation with args", () => {
		const args: GraphqlArg[] = [
			{ name: "name", type: "string", required: true, graphqlType: "String!" },
		];
		const { query, variables } = buildQuery("createUser", "mutation", args, {
			name: "Alice",
		});
		expect(query).toContain("mutation CreateUserOp");
		expect(query).toContain("$name: String!");
		expect(variables).toEqual({ name: "Alice" });
	});

	it("skips args not present in values", () => {
		const args: GraphqlArg[] = [
			{ name: "id", type: "string", required: true, graphqlType: "ID!" },
			{ name: "name", type: "string", required: false, graphqlType: "String" },
		];
		const { query, variables } = buildQuery("getUser", "query", args, {
			id: "123",
		});
		expect(query).not.toContain("name");
		expect(variables).toEqual({ id: "123" });
	});

	it("reconstructs nested variables from flattened args", () => {
		const args: GraphqlArg[] = [
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
		];
		const { variables } = buildQuery("createUser", "mutation", args, {
			input_name: "Alice",
			input_email: "alice@test.com",
		});
		expect(variables).toEqual({
			input: { name: "Alice", email: "alice@test.com" },
		});
	});

	it("uses root arg name in variable declarations for flattened args", () => {
		const args: GraphqlArg[] = [
			{
				name: "input_name",
				type: "string",
				required: true,
				flattenedFrom: "input",
				graphqlType: "String!",
			},
		];
		const { query } = buildQuery("createUser", "mutation", args, {
			input_name: "Alice",
		});
		expect(query).toContain("$input:");
		expect(query).toContain("input: $input");
	});
});
