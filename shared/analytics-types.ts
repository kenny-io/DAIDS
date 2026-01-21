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

export interface AnalyticsSummary {
  totalAudits: number;
  avgScore: number;
  topDomains: Array<{ domain: string; count: number; avgScore: number }>;
  scoreDistribution: Record<string, number>;
  recentAudits: AuditAnalyticsEntry[];
}
