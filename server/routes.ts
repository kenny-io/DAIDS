import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { runAudit, AuditConfigSchema } from "./audit";
import { analyticsStore } from "./analytics";
import { generateMarkdown, generatePDF } from "./export";
import { z } from "zod";

const AuditRequestSchema = z.object({
  url: z.string().url(),
  maxPages: z.coerce.number().int().positive().optional(),
  maxDepth: z.coerce.number().int().positive().optional(),
  concurrency: z.coerce.number().int().positive().optional(),
  timeoutMs: z.coerce.number().int().positive().optional(),
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

      analyticsStore.recordAudit(result);

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

  app.post("/api/export/markdown", async (req: Request, res: Response) => {
    try {
      const result = req.body;

      if (!result || !result.rootUrl || !result.categories) {
        res.status(400).json({
          error: true,
          message: "Invalid audit result data",
        });
        return;
      }

      const markdown = generateMarkdown(result);

      res.setHeader("Content-Type", "text/markdown");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="audit-report-${new Date().toISOString().split("T")[0]}.md"`
      );
      res.send(markdown);
    } catch (error: any) {
      res.status(500).json({
        error: true,
        message: error.message || "Failed to generate export",
      });
    }
  });

  app.post("/api/export/pdf", async (req: Request, res: Response) => {
    try {
      const result = req.body;

      if (!result || !result.rootUrl || !result.categories) {
        res.status(400).json({
          error: true,
          message: "Invalid audit result data",
        });
        return;
      }

      const pdfBuffer = await generatePDF(result);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="audit-report-${new Date().toISOString().split("T")[0]}.pdf"`
      );
      res.send(pdfBuffer);
    } catch (error: any) {
      res.status(500).json({
        error: true,
        message: error.message || "Failed to generate PDF export",
      });
    }
  });

  app.get("/api/analytics", (_req: Request, res: Response) => {
    try {
      const summary = analyticsStore.getSummary();
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({
        error: true,
        message: error.message || "Failed to fetch analytics",
      });
    }
  });

  app.get("/api/analytics/all", (_req: Request, res: Response) => {
    try {
      const entries = analyticsStore.getAll();
      res.json(entries);
    } catch (error: any) {
      res.status(500).json({
        error: true,
        message: error.message || "Failed to fetch analytics",
      });
    }
  });

  app.get("/api/showcase", (req: Request, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
      const entries = analyticsStore.getAll();
      const totalItems = entries.length;
      const totalPages = Math.ceil(totalItems / limit);
      const offset = (page - 1) * limit;
      const items = entries.slice(offset, offset + limit);

      res.json({
        items,
        pagination: {
          page,
          limit,
          totalItems,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        error: true,
        message: error.message || "Failed to fetch showcase",
      });
    }
  });

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "docs-ai-audit" });
  });

  return httpServer;
}
