import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BarChart3, TrendingUp, Globe, Clock, Zap, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import type { AnalyticsSummary } from "@shared/analytics-types";

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <span className={`inline-flex items-center justify-center w-10 h-6 rounded text-xs font-semibold text-white ${color}`}>
      {score}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, subtext }: { icon: typeof TrendingUp; label: string; value: string | number; subtext?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-primary/10">
            <Icon className="w-6 h-6 text-primary" />
          </div>
          <div>
            <div className="text-3xl font-bold">{value}</div>
            <div className="text-sm text-muted-foreground">{label}</div>
            {subtext && <div className="text-xs text-muted-foreground">{subtext}</div>}
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
    { key: "81-100", color: "bg-emerald-500", label: "81-100" },
    { key: "61-80", color: "bg-lime-500", label: "61-80" },
    { key: "41-60", color: "bg-amber-500", label: "41-60" },
    { key: "21-40", color: "bg-orange-500", label: "21-40" },
    { key: "0-20", color: "bg-red-500", label: "0-20" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex h-6 rounded-lg overflow-hidden">
        {segments.map((seg) => {
          const count = distribution[seg.key] || 0;
          const pct = (count / total) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={seg.key}
              className={`${seg.color} flex items-center justify-center text-xs font-medium text-white`}
              style={{ width: `${pct}%` }}
              title={`${seg.label}: ${count}`}
            >
              {pct > 10 && count}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        {segments.map((seg) => (
          <div key={seg.key} className="flex items-center gap-1">
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
          <div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive">Failed to load analytics</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card/50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold">DAIDS Analytics</h1>
              <p className="text-xs text-muted-foreground">Usage and performance metrics</p>
            </div>
          </div>
          <Link href="/">
            <a className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
              Back to Auditor
            </a>
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {!data || data.totalAudits === 0 ? (
          <Card className="text-center py-16">
            <CardContent>
              <BarChart3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">No Analytics Data Yet</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Run some audits to start collecting analytics data. Each audit will be tracked here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            <div className="grid md:grid-cols-3 gap-6">
              <StatCard icon={BarChart3} label="Total Audits" value={data.totalAudits} />
              <StatCard icon={TrendingUp} label="Average Score" value={data.avgScore} subtext="out of 100" />
              <StatCard icon={Globe} label="Unique Domains" value={data.topDomains.length} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Score Distribution</CardTitle>
                <CardDescription>How audited sites are performing overall</CardDescription>
              </CardHeader>
              <CardContent>
                <ScoreDistributionBar distribution={data.scoreDistribution} />
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Top Domains</CardTitle>
                  <CardDescription>Most frequently audited domains</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.topDomains.map((domain, idx) => (
                      <div key={domain.domain} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground w-5">{idx + 1}.</span>
                          <span className="font-medium text-sm">{domain.domain}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary">{domain.count} audits</Badge>
                          <ScoreBadge score={domain.avgScore} />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Audits</CardTitle>
                  <CardDescription>Latest documentation audits</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.recentAudits.slice(0, 8).map((audit) => (
                      <div key={audit.id} className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{audit.domain}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            <Clock className="w-3 h-3" />
                            {new Date(audit.createdAt).toLocaleDateString()}
                            <span className="text-muted-foreground/50">|</span>
                            {audit.crawledPages} pages
                          </div>
                        </div>
                        <ScoreBadge score={audit.score} />
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
