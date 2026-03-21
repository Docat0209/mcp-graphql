import { describe, it, expect } from "vitest";
import {
	isDestructiveMutation,
	applyMutationSafety,
} from "../src/generator/mutation-safety.js";
import type { GeneratedTool } from "../src/generator/tool-generator.js";

function makeTool(
	name: string,
	fieldName: string,
	kind: "query" | "mutation",
): GeneratedTool {
	return {
		name,
		description: `[GraphQL ${kind}: ${fieldName} → Boolean]`,
		inputSchema: { type: "object" },
		fieldRef: { fieldName, kind, args: [] },
	};
}

describe("isDestructiveMutation", () => {
	it("detects delete* pattern", () => {
		expect(isDestructiveMutation("deleteUser")).toBe(true);
		expect(isDestructiveMutation("DeletePost")).toBe(true);
	});

	it("detects remove* pattern", () => {
		expect(isDestructiveMutation("removeMember")).toBe(true);
	});

	it("detects drop* pattern", () => {
		expect(isDestructiveMutation("dropTable")).toBe(true);
	});

	it("detects clear* pattern", () => {
		expect(isDestructiveMutation("clearCache")).toBe(true);
	});

	it("detects truncate* pattern", () => {
		expect(isDestructiveMutation("truncateLog")).toBe(true);
	});

	it("detects destroy* pattern", () => {
		expect(isDestructiveMutation("destroySession")).toBe(true);
	});

	it("detects purge* pattern", () => {
		expect(isDestructiveMutation("purgeOldRecords")).toBe(true);
	});

	it("detects reset* pattern", () => {
		expect(isDestructiveMutation("resetPassword")).toBe(true);
	});

	it("does not match safe mutations", () => {
		expect(isDestructiveMutation("createUser")).toBe(false);
		expect(isDestructiveMutation("updatePost")).toBe(false);
		expect(isDestructiveMutation("getUser")).toBe(false);
		expect(isDestructiveMutation("softDeleteUser")).toBe(false);
	});
});

describe("applyMutationSafety", () => {
	const tools: GeneratedTool[] = [
		makeTool("get_user", "getUser", "query"),
		makeTool("create_user", "createUser", "mutation"),
		makeTool("delete_user", "deleteUser", "mutation"),
		makeTool("remove_post", "removePost", "mutation"),
		makeTool("update_user", "updateUser", "mutation"),
		makeTool("purge_cache", "purgeCache", "mutation"),
	];

	it("returns all tools unchanged in unrestricted mode", () => {
		const result = applyMutationSafety(tools, "unrestricted");
		expect(result).toHaveLength(6);
		expect(result[2].description).not.toContain("DESTRUCTIVE");
	});

	it("adds DESTRUCTIVE prefix in warn mode", () => {
		const result = applyMutationSafety(tools, "warn");
		expect(result).toHaveLength(6);

		// Destructive mutations get warning
		expect(result[2].description).toMatch(/^DESTRUCTIVE:/);
		expect(result[3].description).toMatch(/^DESTRUCTIVE:/);
		expect(result[5].description).toMatch(/^DESTRUCTIVE:/);

		// Non-destructive mutations and queries are unchanged
		expect(result[0].description).not.toContain("DESTRUCTIVE");
		expect(result[1].description).not.toContain("DESTRUCTIVE");
		expect(result[4].description).not.toContain("DESTRUCTIVE");
	});

	it("excludes destructive mutations in safe mode", () => {
		const result = applyMutationSafety(tools, "safe");
		expect(result).toHaveLength(3);
		expect(result.map((t) => t.name)).toEqual([
			"get_user",
			"create_user",
			"update_user",
		]);
	});

	it("does not flag queries even with destructive-sounding names", () => {
		const queryTools: GeneratedTool[] = [
			makeTool("delete_log", "deleteLog", "query"),
		];
		const result = applyMutationSafety(queryTools, "safe");
		expect(result).toHaveLength(1);
	});

	it("handles empty tool list", () => {
		const result = applyMutationSafety([], "warn");
		expect(result).toHaveLength(0);
	});
});
