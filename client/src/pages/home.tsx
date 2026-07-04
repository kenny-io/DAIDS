import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Search,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  FileSearch,
  ArrowRight,
} from "lucide-react";
import { TopNav, PageContainer, SectionLabel } from "@/components/app-chrome";
import { ScoreGauge, ScoreBadge, SiteFavicon } from "@/components/audit-result";
import type { AuditResult, AuditRequest } from "@shared/audit-types";
import type { AuditAnalyticsEntry, ShowcaseResponse } from "@shared/analytics-types";

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

/* --- Platform activity strip -------------------------------------------- */
function StatChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex-1 min-w-[7rem] px-4 py-3">
      <div className="text-xl font-semibold font-mono tabular-nums leading-none">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-1.5 font-medium">{label}</div>
    </div>
  );
}

interface PublicStats {
  totalAudits: number;
  avgScore: number;
  uniqueDomains: number;
  pageviews: number;
}

function ActivityBar() {
  const { data } = useQuery<PublicStats>({ queryKey: ["/api/public-stats"] });
  if (!data || data.totalAudits === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm divide-x divide-border flex overflow-x-auto">
      <StatChip label="Total audits" value={data.totalAudits.toLocaleString()} />
      <StatChip label="Average score" value={data.avgScore} />
      <StatChip label="Unique domains" value={data.uniqueDomains} />
      <StatChip label="Page views" value={data.pageviews.toLocaleString()} />
    </div>
  );
}

/* --- Recent audits: data table (desktop) + cards (mobile) --------------- */
function ShowcaseRow({ entry }: { entry: AuditAnalyticsEntry }) {
  const [, navigate] = useLocation();
  return (
    <tr
      className="group cursor-pointer border-t border-border hover:bg-muted/40 transition-colors"
      onClick={() => navigate(`/audit/${entry.id}`)}
      data-testid={`showcase-row-${entry.id}`}
    >
      <td className="py-3 pl-4 pr-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <SiteFavicon domain={entry.domain} size="md" />
          <div className="min-w-0">
            <div className="font-medium text-[13px] truncate">{entry.domain}</div>
            <div className="text-[11px] text-muted-foreground truncate font-mono">{entry.url}</div>
          </div>
        </div>
      </td>
      <td className="py-3 px-3 w-px"><ScoreBadge score={entry.score} /></td>
      <td className="py-3 px-3 text-[13px] text-muted-foreground tabular-nums text-right whitespace-nowrap">{entry.crawledPages}</td>
      <td className="py-3 px-3 text-[13px] text-muted-foreground tabular-nums text-right whitespace-nowrap">{getTimeAgo(new Date(entry.createdAt))}</td>
      <td className="py-3 pr-4 pl-1 w-px">
        <ArrowRight className="w-4 h-4 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors" />
      </td>
    </tr>
  );
}

function ShowcaseCard({ entry }: { entry: AuditAnalyticsEntry }) {
  const [, navigate] = useLocation();
  return (
    <button
      className="w-full text-left rounded-lg border border-border bg-card shadow-xs p-3.5 active:bg-muted/50 transition-colors"
      onClick={() => navigate(`/audit/${entry.id}`)}
      data-testid={`showcase-card-${entry.id}`}
    >
      <div className="flex items-center gap-3">
        <ScoreGauge score={entry.score} size="small" />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-[13px] inline-flex items-center gap-1.5 truncate max-w-full">
            <SiteFavicon domain={entry.domain} size="sm" />
            <span className="truncate">{entry.domain}</span>
          </div>
          <div className="text-[11px] text-muted-foreground truncate mt-0.5 font-mono">{entry.url}</div>
          <div className="text-[11px] text-muted-foreground/70 mt-1 tabular-nums">
            {entry.crawledPages} pages · {getTimeAgo(new Date(entry.createdAt))}
          </div>
        </div>
      </div>
    </button>
  );
}

function Showcase() {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<"createdAt" | "score">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data, isLoading } = useQuery<ShowcaseResponse>({
    queryKey: ["/api/showcase", page, sortBy, sortDir],
    queryFn: async () => {
      const query = new URLSearchParams({ page: String(page), limit: "18", sortBy, sortDir });
      const res = await fetch(`/api/showcase?${query.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch showcase");
      return res.json();
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-4 border-t border-border first:border-t-0 animate-pulse">
            <div className="w-8 h-8 rounded-md bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-muted rounded w-48" />
              <div className="h-2.5 bg-muted rounded w-32" />
            </div>
            <div className="h-6 w-10 bg-muted rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="text-center py-16 rounded-xl border border-border bg-card" data-testid="showcase-empty">
        <FileSearch className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">No audits yet</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Run your first audit above to get started.</p>
      </div>
    );
  }

  const sortedItems = [...data.items].sort((a, b) => {
    if (sortBy === "score" && a.score !== b.score) {
      return sortDir === "asc" ? a.score - b.score : b.score - a.score;
    }
    const aTime = new Date(a.createdAt).getTime();
    const bTime = new Date(b.createdAt).getTime();
    return sortDir === "asc" ? aTime - bTime : bTime - aTime;
  });

  return (
    <div className="space-y-4" data-testid="showcase-section">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground tabular-nums">
          Showing <span className="text-foreground font-medium">{data.items.length}</span> of {data.pagination.totalItems} audits
        </p>
        <div className="w-full sm:w-52" data-testid="showcase-sort-select">
          <Select
            value={`${sortBy}:${sortDir}`}
            onValueChange={(value) => {
              const [nextSortBy, nextSortDir] = value.split(":") as ["createdAt" | "score", "asc" | "desc"];
              setSortBy(nextSortBy);
              setSortDir(nextSortDir);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 text-[13px]">
              <div className="inline-flex items-center gap-2">
                <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
                <SelectValue placeholder="Sort audits" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt:desc">Newest first</SelectItem>
              <SelectItem value="createdAt:asc">Oldest first</SelectItem>
              <SelectItem value="score:desc">Score: high to low</SelectItem>
              <SelectItem value="score:asc">Score: low to high</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="py-2.5 pl-4 pr-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70 font-medium">Site</th>
              <th className="py-2.5 px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70 font-medium">Score</th>
              <th className="py-2.5 px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70 font-medium text-right">Pages</th>
              <th className="py-2.5 px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70 font-medium text-right">Audited</th>
              <th className="w-px" />
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((entry) => (
              <ShowcaseRow key={entry.id} entry={entry} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="grid md:hidden grid-cols-1 gap-2.5">
        {sortedItems.map((entry) => (
          <ShowcaseCard key={entry.id} entry={entry} />
        ))}
      </div>

      {data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-1" data-testid="showcase-pagination">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p - 1)}
            disabled={!data.pagination.hasPrev}
            className="h-8 w-8 p-0"
            data-testid="button-prev-page"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground px-2 tabular-nums">
            Page {data.pagination.page} of {data.pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={!data.pagination.hasNext}
            className="h-8 w-8 p-0"
            data-testid="button-next-page"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [maxPages, setMaxPages] = useState("50");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const auditMutation = useMutation({
    mutationFn: async (request: AuditRequest) => {
      const response = await apiRequest("POST", "/api/audit", request);
      return (await response.json()) as AuditResult;
    },
    onSuccess: (data) => {
      setUrl("");
      queryClient.invalidateQueries({ queryKey: ["/api/showcase"] });
      if (data.id) navigate(`/audit/${data.id}`);
    },
    onError: (error: Error) => {
      toast({ title: "Audit failed", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      toast({ title: "URL required", description: "Please enter a documentation URL to audit", variant: "destructive" });
      return;
    }
    auditMutation.mutate({ url: url.trim(), maxPages: parseInt(maxPages, 10) || 50 });
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNav suffix="AI readiness" />

      {/* Hero */}
      <div className="relative border-b border-border overflow-hidden">
        <div className="absolute inset-0 bg-dot-grid [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,black,transparent)]" />
        <PageContainer className="relative py-16 sm:py-20">
          <div className="max-w-2xl mx-auto text-center" data-testid="audit-intro">
            <h1 className="text-3xl sm:text-[2.75rem] font-semibold tracking-tight leading-[1.05] mb-4 text-balance">
              Is your documentation
              <br className="hidden sm:block" /> AI&#8209;ready?
            </h1>
            <p className="text-muted-foreground text-[15px] sm:text-base max-w-xl mx-auto leading-relaxed">
              Score your docs for AI discoverability, retrieval readiness, and agent usability.
              Get a prioritized list of fixes and a score out of 100.
            </p>

            {/* Command bar */}
            <form onSubmit={handleSubmit} className="mt-8 max-w-xl mx-auto">
              <div className="flex gap-1.5 p-1.5 bg-card rounded-xl border border-border shadow-md focus-within:ring-2 focus-within:ring-ring/40 transition-shadow">
                <div className="flex items-center pl-2.5 text-muted-foreground">
                  <Search className="w-4 h-4" />
                </div>
                <Input
                  type="url"
                  placeholder="https://docs.example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={auditMutation.isPending}
                  className="flex-1 min-w-0 h-10 border-0 bg-transparent text-[15px] focus-visible:ring-0 focus-visible:ring-offset-0 px-1 placeholder:text-muted-foreground/50 shadow-none"
                  data-testid="input-url"
                />
                <Button type="submit" disabled={auditMutation.isPending} className="h-10 px-5 shrink-0 gap-2" data-testid="button-start-audit">
                  {auditMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin opacity-70" />
                      Auditing…
                    </>
                  ) : (
                    <>
                      Run audit
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>

              <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                <div className="flex justify-center mt-2.5">
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" className="text-xs text-muted-foreground h-7" data-testid="button-advanced-options">
                      Advanced options {showAdvanced ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="pt-2">
                  <div className="flex justify-center">
                    <div className="w-40 text-left">
                      <Label htmlFor="maxPages" className="text-[11px] text-muted-foreground font-medium">Max pages to crawl</Label>
                      <Input
                        id="maxPages"
                        type="number"
                        min="1"
                        max="500"
                        value={maxPages}
                        onChange={(e) => setMaxPages(e.target.value)}
                        disabled={auditMutation.isPending}
                        className="h-9 mt-1 tabular-nums"
                        data-testid="input-max-pages"
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </form>

            {/* Signal tags */}
            <div className="flex flex-wrap justify-center gap-1.5 mt-8">
              {["Agent discovery", "Structure & chunking", "Retrieval quality", "Developer usability", "Trust signals"].map((tag) => (
                <span key={tag} className="px-2.5 py-1 rounded-md bg-card border border-border text-muted-foreground text-[11px] font-medium">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </PageContainer>
      </div>

      <PageContainer className="py-10">
        {auditMutation.isPending ? (
          <div className="py-20 text-center">
            <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin mx-auto mb-5" />
            <p className="font-medium text-foreground/80">Crawling and analyzing…</p>
            <p className="text-sm text-muted-foreground mt-1.5">This may take up to a minute.</p>
          </div>
        ) : (
          <div className="space-y-8">
            <ActivityBar />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <SectionLabel>Showcase</SectionLabel>
                  <h2 className="text-lg font-semibold tracking-tight mt-1">Recent audits</h2>
                </div>
              </div>
              <Showcase />
            </div>
          </div>
        )}
      </PageContainer>
    </div>
  );
}
