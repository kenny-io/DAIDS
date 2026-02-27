export interface AuditAnalyticsEntry {
  id: string;
  url: string;
  domain: string;
  score: number;
  crawledPages: number;
  categoryScores: Record<string, number>;
  durationMs: number;
  errorCount: number;
  createdAt: string;
}

export type ShowcaseSortBy = "createdAt" | "score";
export type SortDirection = "asc" | "desc";

export interface ShowcasePagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ShowcaseResponse {
  items: AuditAnalyticsEntry[];
  pagination: ShowcasePagination;
}

export interface AnalyticsSummary {
  totalAudits: number;
  avgScore: number;
  topDomains: Array<{ domain: string; count: number; avgScore: number }>;
  scoreDistribution: Record<string, number>;
  recentAudits: AuditAnalyticsEntry[];
}
