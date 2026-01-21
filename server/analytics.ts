import { randomUUID } from "crypto";
import type { AuditResult } from "./audit/types";
import type { AuditAnalyticsEntry, AnalyticsSummary } from "@shared/analytics-types";

class AnalyticsStore {
  private entries: AuditAnalyticsEntry[] = [];

  recordAudit(result: AuditResult): AuditAnalyticsEntry {
    const url = new URL(result.rootUrl);
    const domain = url.hostname;

    const categoryScores: Record<string, number> = {};
    for (const cat of result.categories) {
      categoryScores[cat.name] = cat.score;
    }

    const entry: AuditAnalyticsEntry = {
      id: randomUUID(),
      url: result.rootUrl,
      domain,
      score: result.score,
      crawledPages: result.crawledPages,
      categoryScores,
      durationMs: result.meta.durationMs,
      errorCount: result.meta.errorCount,
      createdAt: new Date().toISOString(),
    };

    this.entries.unshift(entry);

    if (this.entries.length > 1000) {
      this.entries = this.entries.slice(0, 1000);
    }

    return entry;
  }

  getSummary(): AnalyticsSummary {
    const totalAudits = this.entries.length;

    if (totalAudits === 0) {
      return {
        totalAudits: 0,
        avgScore: 0,
        topDomains: [],
        scoreDistribution: { "0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0 },
        recentAudits: [],
      };
    }

    const avgScore = Math.round(
      this.entries.reduce((sum, e) => sum + e.score, 0) / totalAudits
    );

    const domainMap = new Map<string, { count: number; totalScore: number }>();
    for (const entry of this.entries) {
      const existing = domainMap.get(entry.domain) || { count: 0, totalScore: 0 };
      existing.count++;
      existing.totalScore += entry.score;
      domainMap.set(entry.domain, existing);
    }

    const topDomains = Array.from(domainMap.entries())
      .map(([domain, data]) => ({
        domain,
        count: data.count,
        avgScore: Math.round(data.totalScore / data.count),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const scoreDistribution: Record<string, number> = {
      "0-20": 0,
      "21-40": 0,
      "41-60": 0,
      "61-80": 0,
      "81-100": 0,
    };

    for (const entry of this.entries) {
      if (entry.score <= 20) scoreDistribution["0-20"]++;
      else if (entry.score <= 40) scoreDistribution["21-40"]++;
      else if (entry.score <= 60) scoreDistribution["41-60"]++;
      else if (entry.score <= 80) scoreDistribution["61-80"]++;
      else scoreDistribution["81-100"]++;
    }

    return {
      totalAudits,
      avgScore,
      topDomains,
      scoreDistribution,
      recentAudits: this.entries.slice(0, 20),
    };
  }

  getAll(): AuditAnalyticsEntry[] {
    return this.entries;
  }
}

export const analyticsStore = new AnalyticsStore();
