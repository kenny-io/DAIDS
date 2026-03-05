import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { runAudit, AuditConfigSchema } from "./audit";
import { analyticsStore } from "./analytics";
import { generateMarkdown, generatePDF } from "./export";
import { generateAuditOgImage, escapeHtml } from "./og";
import { z } from "zod";
import type { ShowcaseSortBy, SortDirection } from "@shared/analytics-types";

const SOCIAL_CRAWLERS = [
  "twitterbot", "linkedinbot", "slackbot", "facebookexternalhit",
  "whatsapp", "discordbot", "telegrambot", "googlebot", "bingbot",
  "meta-externalagent", "ia_archiver", "applebot",
];

function isSocialCrawler(ua: string): boolean {
  const lower = ua.toLowerCase();
  return SOCIAL_CRAWLERS.some((bot) => lower.includes(bot));
}

function getDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function buildCrawlerHtml(title: string, description: string, ogImageUrl: string): string {
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const img = escapeHtml(ogImageUrl);
  return `<!DOCTYPE html><html><head>
<meta charset="UTF-8" />
<title>${t}</title>
<meta name="description" content="${d}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="AuditDocs" />
<meta property="og:title" content="${t}" />
<meta property="og:description" content="${d}" />
<meta property="og:image" content="${img}" />
<meta property="og:image:type" content="image/png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${t}" />
<meta name="twitter:description" content="${d}" />
<meta name="twitter:image" content="${img}" />
</head><body></body></html>`;
}

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
  // Crawler interception: return custom meta tags for social previews on audit pages
  app.get("/audit/:id", async (req: Request, res: Response, next: NextFunction) => {
    const ua = req.headers["user-agent"] || "";
    if (!isSocialCrawler(ua)) return next();

    try {
      const id = req.params.id as string;
      const result = await analyticsStore.getResultById(id);
      if (!result) return next();

      const domain = getDomainFromUrl(result.rootUrl);
      const baseUrl =
        process.env.BASE_URL ||
        `${req.protocol}://${req.get("host") as string}`;
      const ogImageUrl = `${baseUrl}/api/og/audit/${id}.png`;
      const title = `${domain} — ${result.score}/100 | AuditDocs`;
      const description = `AI discoverability audit for ${domain}. Score: ${result.score}/100 across ${result.crawledPages} pages crawled.`;

      res.type("html").send(buildCrawlerHtml(title, description, ogImageUrl));
    } catch {
      next();
    }
  });

  // Dynamic OG image for audit results
  app.get("/api/og/audit/:id.png", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const result = await analyticsStore.getResultById(id);
      if (!result) {
        res.status(404).json({ error: true, message: "Audit result not found" });
        return;
      }

      const domain = getDomainFromUrl(result.rootUrl);
      const png = generateAuditOgImage(id, domain, result.score, result.crawledPages);

      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=300");
      res.send(png);
    } catch (error: any) {
      res.status(500).json({ error: true, message: error.message || "Failed to generate OG image" });
    }
  });

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

      const entry = await analyticsStore.recordAudit(result);

      res.json({ ...result, id: entry.id });
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

  app.get("/api/analytics", async (_req: Request, res: Response) => {
    try {
      const summary = await analyticsStore.getSummary();
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({
        error: true,
        message: error.message || "Failed to fetch analytics",
      });
    }
  });

  app.get("/api/analytics/all", async (req: Request, res: Response) => {
    try {
      const sortBy = req.query.sortBy === "score" ? "score" : "createdAt";
      const sortDir = req.query.sortDir === "asc" ? "asc" : "desc";
      const entries = await analyticsStore.getAll(sortBy, sortDir);
      res.json(entries);
    } catch (error: any) {
      res.status(500).json({
        error: true,
        message: error.message || "Failed to fetch analytics",
      });
    }
  });

  app.get("/api/showcase", async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 18));
      const sortBy: ShowcaseSortBy = req.query.sortBy === "score" ? "score" : "createdAt";
      const sortDir: SortDirection = req.query.sortDir === "asc" ? "asc" : "desc";

      const response = await analyticsStore.getShowcase({
        page,
        limit,
        sortBy,
        sortDir,
      });

      res.json(response);
    } catch (error: any) {
      res.status(500).json({
        error: true,
        message: error.message || "Failed to fetch showcase",
      });
    }
  });

  app.get("/api/audit/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const result = await analyticsStore.getResultById(id);
      if (!result) {
        return res.status(404).json({ error: true, message: "Audit result not found" });
      }
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        error: true,
        message: error.message || "Failed to fetch audit result",
      });
    }
  });

  app.post("/api/pageview", async (req: Request, res: Response) => {
    try {
      const path = typeof req.body.path === "string" ? req.body.path : "/";
      const referrer = typeof req.body.referrer === "string" ? req.body.referrer : undefined;
      await analyticsStore.recordPageview(path, referrer);
    } catch {
      // fire-and-forget: don't fail the user
    }
    res.json({ ok: true });
  });

  app.get("/api/analytics/pageviews", async (_req: Request, res: Response) => {
    try {
      const count = await analyticsStore.getPageviewCount();
      res.json({ count });
    } catch (error: any) {
      res.status(500).json({ error: true, message: error.message || "Failed to fetch pageview count" });
    }
  });

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "docs-ai-audit" });
  });

  return httpServer;
}
