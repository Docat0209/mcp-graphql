import type { MutationSafetyMode } from "../config/types.js";
import type { GeneratedTool } from "./tool-generator.js";
import { logger } from "../utils/logger.js";

const DESTRUCTIVE_PATTERNS =
	/^(delete|remove|drop|clear|truncate|destroy|purge|reset)/i;

/**
 * Check if a mutation field name matches destructive patterns.
 */
export function isDestructiveMutation(fieldName: string): boolean {
	return DESTRUCTIVE_PATTERNS.test(fieldName);
}

/**
 * Apply mutation safety filtering/labeling to generated tools.
 */
export function applyMutationSafety(
	tools: GeneratedTool[],
	mode: MutationSafetyMode,
): GeneratedTool[] {
	if (mode === "unrestricted") return tools;

	const destructiveCount = tools.filter(
		(t) =>
			t.fieldRef.kind === "mutation" &&
			isDestructiveMutation(t.fieldRef.fieldName),
	).length;

	if (destructiveCount > 0) {
		logger.warn(
			`Mutation safety: ${destructiveCount} destructive mutation${destructiveCount > 1 ? "s" : ""} detected (mode: ${mode})`,
		);
	}

	if (mode === "safe") {
		return tools.filter(
			(t) =>
				t.fieldRef.kind !== "mutation" ||
				!isDestructiveMutation(t.fieldRef.fieldName),
		);
	}

	// mode === "warn": add warning prefix to description
	return tools.map((t) => {
		if (
			t.fieldRef.kind === "mutation" &&
			isDestructiveMutation(t.fieldRef.fieldName)
		) {
			return {
				...t,
				description: `DESTRUCTIVE: ${t.description}`,
			};
		}
		return t;
	});
}
