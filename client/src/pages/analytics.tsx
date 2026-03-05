import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Globe, Clock, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import type { AnalyticsSummary } from "@shared/analytics-types";

function ScorePill({ score }: { score: number }) {
  const color =
    score >= 80 ? "bg-emerald-500/10 text-emerald-600 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40"
    : score >= 50 ? "bg-amber-500/10 text-amber-600 border-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40"
    : "bg-red-500/10 text-red-500 border-red-200/60 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/40";
  return (
    <span className={`inline-flex items-center justify-center w-10 h-6 rounded-lg text-xs font-semibold border tabular-nums ${color}`}>
      {score}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, subtext }: { icon: typeof TrendingUp; label: string; value: string | number; subtext?: string }) {
  return (
    <Card className="rounded-2xl shadow-sm border-border/60 bg-card">
      <CardContent className="pt-6 pb-5">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary/8 dark:bg-primary/10">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="text-3xl font-bold tabular-nums tracking-tight">{value}</div>
            <div className="text-sm text-muted-foreground font-medium mt-0.5">{label}</div>
            {subtext && <div className="text-xs text-muted-foreground/70 mt-0.5">{subtext}</div>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreDistributionBar({ distribution }: { distribution: Record<string, number> }) {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const segments = [
    { key: "81-100", color: "bg-emerald-500", label: "81–100" },
    { key: "61-80", color: "bg-lime-500", label: "61–80" },
    { key: "41-60", color: "bg-amber-500", label: "41–60" },
    { key: "21-40", color: "bg-orange-500", label: "21–40" },
    { key: "0-20", color: "bg-red-500", label: "0–20" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex h-5 rounded-xl overflow-hidden gap-0.5">
        {segments.map((seg) => {
          const count = distribution[seg.key] || 0;
          const pct = (count / total) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={seg.key}
              className={`${seg.color} flex items-center justify-center text-xs font-semibold text-white rounded-sm first:rounded-l-xl last:rounded-r-xl`}
              style={{ width: `${pct}%` }}
              title={`${seg.label}: ${count}`}
            >
              {pct > 10 && count}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((seg) => (
          <div key={seg.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`w-2 h-2 rounded-full ${seg.color}`} />
            {seg.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Analytics() {
  const { data, isLoading, error } = useQuery<AnalyticsSummary>({
    queryKey: ["/api/analytics"],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">Loading analytics…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md rounded-2xl shadow-sm border-border/60">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive font-medium">Failed to load analytics</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar — frosted glass */}
      <div className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl overflow-hidden shadow-sm">
              <img src="/logo-mark.svg" alt="AuditDocs" className="h-full w-full" />
            </div>
            <span className="font-semibold text-[15px] tracking-tight">AuditDocs Analytics</span>
          </div>
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
            data-testid="link-back-auditor"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {!data || data.totalAudits === 0 ? (
          <Card className="text-center py-20 rounded-2xl shadow-sm border-border/60">
            <CardContent>
              <BarChart3 className="w-10 h-10 mx-auto mb-4 text-muted-foreground/40" />
              <h2 className="text-xl font-bold tracking-tight mb-2">No data yet</h2>
              <p className="text-muted-foreground max-w-sm mx-auto text-sm leading-relaxed">
                Run some audits to start collecting analytics. Each audit is tracked here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Stat cards */}
            <div className="grid md:grid-cols-3 gap-4">
              <StatCard icon={BarChart3} label="Total Audits" value={data.totalAudits} />
              <StatCard icon={TrendingUp} label="Average Score" value={data.avgScore} subtext="out of 100" />
              <StatCard icon={Globe} label="Unique Domains" value={data.topDomains.length} />
            </div>

            {/* Score distribution */}
            <Card className="rounded-2xl shadow-sm border-border/60">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold tracking-tight">Score Distribution</CardTitle>
                <CardDescription>How audited sites are performing overall</CardDescription>
              </CardHeader>
              <CardContent>
                <ScoreDistributionBar distribution={data.scoreDistribution} />
              </CardContent>
            </Card>

            {/* Tables */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="rounded-2xl shadow-sm border-border/60">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base font-semibold tracking-tight">Top Domains</CardTitle>
                  <CardDescription>Most frequently audited</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.topDomains.map((domain, idx) => (
                      <div key={domain.domain} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-sm text-muted-foreground/60 font-medium tabular-nums w-4 shrink-0">{idx + 1}</span>
                          <span className="font-medium text-sm truncate">{domain.domain}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-3">
                          <span className="text-xs text-muted-foreground">{domain.count} audits</span>
                          <ScorePill score={domain.avgScore} />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm border-border/60">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base font-semibold tracking-tight">Recent Audits</CardTitle>
                  <CardDescription>Latest documentation audits</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.recentAudits.slice(0, 8).map((audit) => (
                      <div key={audit.id} className="flex items-center justify-between py-1">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{audit.domain}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {new Date(audit.createdAt).toLocaleDateString()}
                            <span className="text-muted-foreground/40">·</span>
                            {audit.crawledPages} pages
                          </div>
                        </div>
                        <ScorePill score={audit.score} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
