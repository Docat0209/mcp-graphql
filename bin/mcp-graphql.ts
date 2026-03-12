#!/usr/bin/env node
import { parseCliArgs } from "../src/config/cli-args.js";
import { startServer } from "../src/server.js";
import { logger } from "../src/utils/logger.js";

const config = parseCliArgs(process.argv.slice(2));

if (config) {
	startServer(config).catch((err) => {
		logger.error(err instanceof Error ? err.message : String(err));
		process.exit(1);
	});
}
