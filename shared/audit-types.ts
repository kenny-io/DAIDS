export type FindingSeverity = "pass" | "low" | "med" | "high";

export interface Finding {
  severity: FindingSeverity;
  message: string;
  detail?: string;
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

export interface AuditRequest {
  url: string;
  maxPages?: number;
  maxDepth?: number;
  concurrency?: number;
  timeoutMs?: number;
}
