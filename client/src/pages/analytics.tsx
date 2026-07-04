import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, TrendingUp, Globe, Clock, Eye, Lock } from "lucide-react";
import { TopNav, PageContainer, SectionLabel } from "@/components/app-chrome";
import { ScoreBadge } from "@/components/audit-result";
import type { AnalyticsSummary } from "@shared/analytics-types";

function StatCard({ icon: Icon, label, value, subtext }: { icon: typeof TrendingUp; label: string; value: string | number; subtext?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70 font-medium">{label}</span>
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-muted border border-border text-muted-foreground">
          <Icon className="w-3.5 h-3.5" />
        </div>
      </div>
      <div className="text-2xl font-semibold font-mono tabular-nums tracking-tight leading-none">{value}</div>
      {subtext && <div className="text-[11px] text-muted-foreground/70 mt-1.5">{subtext}</div>}
    </div>
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
      <div className="flex h-6 rounded-md overflow-hidden gap-0.5">
        {segments.map((seg) => {
          const count = distribution[seg.key] || 0;
          const pct = (count / total) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={seg.key}
              className={`${seg.color} flex items-center justify-center text-[11px] font-semibold text-white tabular-nums first:rounded-l-md last:rounded-r-md`}
              style={{ width: `${pct}%` }}
              title={`${seg.label}: ${count}`}
            >
              {pct > 9 && count}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map((seg) => (
          <div key={seg.key} className="flex items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums">
            <span className={`w-2 h-2 rounded-sm ${seg.color}`} />
            {seg.label}
            <span className="text-muted-foreground/50">· {distribution[seg.key] || 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

const AUTH_KEY = "analytics_key";

async function authedFetch<T>(url: string): Promise<T> {
  const key = sessionStorage.getItem(AUTH_KEY) ?? "";
  const res = await fetch(url, { headers: { "x-analytics-key": key }, credentials: "include" });
  if (!res.ok) {
    const err = new Error(`${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

function AnalyticsDashboard({ onUnauthorized }: { onUnauthorized: () => void }) {
  const { data, isLoading, error } = useQuery<AnalyticsSummary>({
    queryKey: ["/api/analytics"],
    queryFn: () => authedFetch<AnalyticsSummary>("/api/analytics"),
  });
  const { data: pageviewData } = useQuery<{ count: number }>({
    queryKey: ["/api/analytics/pageviews"],
    queryFn: () => authedFetch<{ count: number }>("/api/analytics/pageviews"),
  });

  // A rotated/incorrect key surfaces as a 401 on the data request — drop the
  // stored key and fall back to the login form rather than showing an error.
  useEffect(() => {
    if ((error as { status?: number } | null)?.status === 401) {
      sessionStorage.removeItem(AUTH_KEY);
      onUnauthorized();
    }
  }, [error, onUnauthorized]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <TopNav suffix="Analytics" />
        <div className="flex items-center justify-center py-40">
          <div className="text-center">
            <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground font-medium text-sm">Loading analytics…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav suffix="Analytics" />

      <PageContainer className="py-10">
        <div className="mb-8">
          <SectionLabel>Platform</SectionLabel>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Aggregate performance across every documentation audit.</p>
        </div>

        {error ? (
          <div className="rounded-xl border border-border bg-card shadow-sm max-w-md py-12 px-6 text-center">
            <p className="text-destructive font-medium text-sm">Failed to load analytics</p>
          </div>
        ) : !data || data.totalAudits === 0 ? (
          <div className="rounded-xl border border-border bg-card shadow-sm text-center py-20">
            <BarChart3 className="w-10 h-10 mx-auto mb-4 text-muted-foreground/40" />
            <h2 className="text-lg font-semibold tracking-tight mb-2">No data yet</h2>
            <p className="text-muted-foreground max-w-sm mx-auto text-sm leading-relaxed">
              Run some audits to start collecting analytics. Each audit is tracked here.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={BarChart3} label="Total audits" value={data.totalAudits.toLocaleString()} />
              <StatCard icon={TrendingUp} label="Average score" value={data.avgScore} subtext="out of 100" />
              <StatCard icon={Globe} label="Unique domains" value={data.topDomains.length} />
              <StatCard icon={Eye} label="Page views" value={pageviewData?.count?.toLocaleString() ?? "—"} />
            </div>

            <Panel title="Score distribution" description="How audited sites are performing overall">
              <ScoreDistributionBar distribution={data.scoreDistribution} />
            </Panel>

            <div className="grid md:grid-cols-2 gap-5">
              <Panel title="Top domains" description="Most frequently audited">
                <div className="divide-y divide-border -my-1">
                  {data.topDomains.map((domain, idx) => (
                    <div key={domain.domain} className="flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-[11px] text-muted-foreground/50 font-mono tabular-nums w-4 shrink-0">{idx + 1}</span>
                        <span className="font-medium text-[13px] truncate">{domain.domain}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        <span className="text-[11px] text-muted-foreground tabular-nums">{domain.count} audits</span>
                        <ScoreBadge score={domain.avgScore} />
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Recent audits" description="Latest documentation audits">
                <div className="divide-y divide-border -my-1">
                  {data.recentAudits.slice(0, 8).map((audit) => (
                    <div key={audit.id} className="flex items-center justify-between py-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-[13px] truncate">{audit.domain}</div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5 tabular-nums">
                          <Clock className="w-3 h-3" />
                          {new Date(audit.createdAt).toLocaleDateString()}
                          <span className="text-muted-foreground/40">·</span>
                          {audit.crawledPages} pages
                        </div>
                      </div>
                      <ScoreBadge score={audit.score} />
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </div>
        )}
      </PageContainer>
    </div>
  );
}

function AnalyticsLogin({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/analytics/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        // Store the password itself — the dashboard's data requests send it as
        // the x-analytics-key header, which is where access is actually enforced.
        sessionStorage.setItem(AUTH_KEY, password);
        onSuccess();
        return;
      }
      const body = await res.json().catch(() => ({}));
      setError(body.message || (res.status === 401 ? "Incorrect password." : "Unable to verify."));
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNav suffix="Analytics" showNav={false} />
      <div className="flex items-center justify-center px-4 py-32">
        <form
          onSubmit={submit}
          className="w-full max-w-sm rounded-xl border border-border bg-card shadow-sm p-6"
        >
          <div className="flex items-center justify-center w-11 h-11 rounded-lg bg-muted border border-border mx-auto mb-4">
            <Lock className="w-5 h-5 text-muted-foreground" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-center">Restricted</h1>
          <p className="text-sm text-muted-foreground text-center mt-1 mb-5">
            The analytics dashboard is private. Enter the password to continue.
          </p>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            aria-label="Analytics password"
            className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
          {error && <p className="text-destructive text-xs mt-2">{error}</p>}
          <button
            type="submit"
            disabled={submitting || !password}
            className="mt-4 w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            {submitting ? "Verifying…" : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Analytics() {
  const [authed, setAuthed] = useState(() => !!sessionStorage.getItem(AUTH_KEY));
  if (!authed) return <AnalyticsLogin onSuccess={() => setAuthed(true)} />;
  return <AnalyticsDashboard onUnauthorized={() => setAuthed(false)} />;
}
