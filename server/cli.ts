#!/usr/bin/env node
import { Command } from "commander";
import { runAudit, AuditConfigSchema } from "./audit";

const program = new Command();

program
  .name("docs-ai-audit")
  .description("Audit a docs URL for AI agent discoverability")
  .version("1.0.0")
  .argument("<url>", "The root URL of the documentation site to audit")
  .option("--maxPages <number>", "Maximum number of pages to crawl", "150")
  .option("--maxDepth <number>", "Maximum crawl depth from root", "3")
  .option("--concurrency <number>", "Number of concurrent requests", "8")
  .option("--timeoutMs <number>", "Request timeout in milliseconds", "12000")
  .option("--userAgent <string>", "User agent string", "docs-ai-audit/1.0")
  .action(async (url: string, options: Record<string, string>) => {
    try {
      const config = {
        url,
        maxPages: parseInt(options.maxPages, 10),
        maxDepth: parseInt(options.maxDepth, 10),
        concurrency: parseInt(options.concurrency, 10),
        timeoutMs: parseInt(options.timeoutMs, 10),
        userAgent: options.userAgent,
      };

      const validatedConfig = AuditConfigSchema.parse(config);

      const result = await runAudit(validatedConfig);

      console.log(JSON.stringify(result, null, 2));

      process.exit(0);
    } catch (error: any) {
      console.error(
        JSON.stringify(
          {
            error: true,
            message: error.message || "Unknown error occurred",
          },
          null,
          2
        )
      );
      process.exit(1);
    }
  });

program.parse();
