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

export interface FAQItem {
  question: string;
  answer: string;
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
  // AI-specific extraction
  hasJsonLd: boolean;
  jsonLdTypes: string[];
  hasFAQSchema: boolean;
  faqItems: FAQItem[];
  hasOpenAPILink: boolean;
  openAPIUrl: string | null;
  hasPrerequisites: boolean;
  internalLinkCount: number;
  externalLinkCount: number;
  codeLanguages: string[];
  // Clean HTML signals
  scriptCount: number;
  htmlSize: number;
  textToHtmlRatio: number;
}

export interface AIDiscoveryFiles {
  llmsTxt: {
    exists: boolean;
    content: string | null;
    hasProductDescription: boolean;
    hasDocumentationLinks: boolean;
    hasUseCases: boolean;
  };
  robotsTxt: {
    exists: boolean;
    content: string | null;
    allowsAICrawlers: boolean;
    blocksAICrawlers: boolean;
    mentionsSitemap: boolean;
    aiCrawlerRules: string[];
  };
  sitemap: {
    exists: boolean;
    urlCount: number;
    hasLastmod: boolean;
    coverageRatio: number;
  };
  aiLandingPage: {
    exists: boolean;
    url: string | null;
  };
}

export interface ContentChunk {
  pageUrl: string;
  content: string;
  tokenEstimate: number;
  headingContext: string | null;
}

export type FindingSeverity = "pass" | "low" | "med" | "high";

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
