import { z } from "zod";

export const AuditConfigSchema = z.object({
  url: z.string().url(),
  maxPages: z.number().int().positive().default(150),
  maxDepth: z.number().int().positive().default(3),
  concurrency: z.number().int().positive().default(8),
  timeoutMs: z.number().int().positive().default(12000),
  userAgent: z.string().default("docs-ai-audit/1.0"),
});

export type AuditConfig = z.infer<typeof AuditConfigSchema>;

export interface PageHeading {
  level: number;
  text: string;
}

export interface CodeBlock {
  language: string | null;
  content: string;
}

export interface ExtractedPage {
  url: string;
  title: string | null;
  canonical: string | null;
  metaDescription: string | null;
  headings: PageHeading[];
  codeBlocks: CodeBlock[];
  internalLinks: string[];
  mainContent: string;
  rawHtml: string;
  statusCode: number;
  error?: string;
}

export interface ContentChunk {
  pageUrl: string;
  content: string;
  tokenEstimate: number;
  headingContext: string | null;
}

export type FindingSeverity = "low" | "med" | "high";

export interface Finding {
  severity: FindingSeverity;
  message: string;
  urls: string[];
}

export interface CategoryResult {
  name: string;
  score: number;
  max: number;
  findings: Finding[];
}

export interface AuditMeta {
  chunkCount: number;
  durationMs: number;
  errorCount: number;
  skippedPages: number;
  jsRenderedWarning?: boolean;
}

export interface AuditResult {
  rootUrl: string;
  crawledPages: number;
  score: number;
  categories: CategoryResult[];
  topFindings: Finding[];
  meta: AuditMeta;
}

export interface CrawlResult {
  pages: ExtractedPage[];
  errorCount: number;
  skippedCount: number;
}
