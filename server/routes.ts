import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { runAudit, AuditConfigSchema } from "./audit";
import { z } from "zod";

const AuditRequestSchema = z.object({
  url: z.string().url(),
  maxPages: z.number().int().positive().optional(),
  maxDepth: z.number().int().positive().optional(),
  concurrency: z.number().int().positive().optional(),
  timeoutMs: z.number().int().positive().optional(),
  userAgent: z.string().optional(),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post("/api/audit", async (req: Request, res: Response) => {
    try {
      const parsed = AuditRequestSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          error: true,
          message: "Invalid request body",
          details: parsed.error.errors,
        });
        return;
      }

      const result = await runAudit(parsed.data);

      res.json(result);
    } catch (error: any) {
      const isSSRFError = error.message?.includes("SSRF");
      const statusCode = isSSRFError ? 403 : 500;

      res.status(statusCode).json({
        error: true,
        message: error.message || "An error occurred during the audit",
      });
    }
  });

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "docs-ai-audit" });
  });

  return httpServer;
}
