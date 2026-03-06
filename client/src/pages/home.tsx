import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
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
  Globe,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { ScoreGauge, getScoreLabel } from "@/components/audit-result";
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

function ShowcaseCard({ entry }: { entry: AuditAnalyticsEntry }) {
  const [, navigate] = useLocation();
  const timeAgo = getTimeAgo(new Date(entry.createdAt));

  return (
    <Card
      className="cursor-pointer bg-card shadow-sm border-border/60 hover:shadow-md transition-all duration-200 rounded-2xl"
      data-testid={`showcase-card-${entry.id}`}
      onClick={() => navigate(`/audit/${entry.id}`)}
    >
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-3">
          <ScoreGauge score={entry.score} size="small" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm inline-flex items-center gap-1.5 truncate max-w-full">
              <Globe className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{entry.domain}</span>
            </div>
            <div className="text-xs text-muted-foreground truncate mt-0.5">{entry.url}</div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{entry.crawledPages} pages crawled</span>
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
        </div>
      </CardContent>
    </Card>
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
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse rounded-2xl shadow-sm border-border/60">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded-lg w-48" />
                  <div className="h-3 bg-muted rounded-lg w-32" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <Card className="text-center py-12 rounded-2xl shadow-sm border-border/60" data-testid="showcase-empty">
        <CardContent>
          <Globe className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm font-medium text-muted-foreground">No audits yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Run your first audit above to get started.</p>
        </CardContent>
      </Card>
    );
  }

  const sortedItems = [...data.items].sort((a, b) => {
    if (sortBy === "score") {
      if (a.score !== b.score) return sortDir === "asc" ? a.score - b.score : b.score - a.score;
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return sortDir === "asc" ? aTime - bTime : bTime - aTime;
    }
    const aTime = new Date(a.createdAt).getTime();
    const bTime = new Date(b.createdAt).getTime();
    return sortDir === "asc" ? aTime - bTime : bTime - aTime;
  });

  return (
    <div className="space-y-5" data-testid="showcase-section">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {data.items.length} of {data.pagination.totalItems} audits
        </p>
        <div className="w-full sm:w-56" data-testid="showcase-sort-select">
          <Select
            value={`${sortBy}:${sortDir}`}
            onValueChange={(value) => {
              const [nextSortBy, nextSortDir] = value.split(":") as ["createdAt" | "score", "asc" | "desc"];
              setSortBy(nextSortBy);
              setSortDir(nextSortDir);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 rounded-xl border-border/60 bg-card shadow-sm text-sm">
              <div className="inline-flex items-center gap-2">
                <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
                <SelectValue placeholder="Sort audits" />
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="createdAt:desc">Newest first</SelectItem>
              <SelectItem value="createdAt:asc">Oldest first</SelectItem>
              <SelectItem value="score:desc">Score: high to low</SelectItem>
              <SelectItem value="score:asc">Score: low to high</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sortedItems.map((entry) => (
          <ShowcaseCard key={entry.id} entry={entry} />
        ))}
      </div>

      {data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2" data-testid="showcase-pagination">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => p - 1)}
            disabled={!data.pagination.hasPrev}
            className="rounded-xl border-border/60 shadow-sm"
            data-testid="button-prev-page"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground px-3 tabular-nums">
            {data.pagination.page} / {data.pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => p + 1)}
            disabled={!data.pagination.hasNext}
            className="rounded-xl border-border/60 shadow-sm"
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
      return await response.json() as AuditResult;
    },
    onSuccess: (data) => {
      setUrl("");
      queryClient.invalidateQueries({ queryKey: ["/api/showcase"] });
      if (data.id) {
        navigate(`/audit/${data.id}`);
      }
    },
    onError: (error: Error) => {
      toast({ title: "Audit Failed", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      toast({ title: "URL Required", description: "Please enter a documentation URL to audit", variant: "destructive" });
      return;
    }
    auditMutation.mutate({ url: url.trim(), maxPages: parseInt(maxPages, 10) || 50 });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <div className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl overflow-hidden shadow-sm">
              <img src="/logo-mark.svg" alt="AuditDocs" className="h-full w-full" />
            </div>
            <span className="font-semibold text-[15px] tracking-tight">AuditDocs</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-14">
        {/* Hero */}
        <div className="text-center mb-10" data-testid="audit-intro">
          <h2 className="text-4xl font-bold tracking-tight mb-4">
            Is your documentation AI-ready?
          </h2>
          <p className="text-muted-foreground text-[17px] max-w-xl mx-auto leading-relaxed mb-6">
            Score your docs for AI discoverability, retrieval readiness, and agent usability.
            Get a prioritized list of fixes and a score out of 100.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mb-4">
            {["Agent discovery", "Structure & chunking", "Retrieval quality", "Developer usability", "Trust signals"].map(tag => (
              <span key={tag} className="px-3 py-1 rounded-full bg-muted border border-border/60 text-muted-foreground text-xs font-medium">
                {tag}
              </span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground/60" data-testid="text-fresh-runs-note">
            Every audit is live — results are never cached.
          </p>
        </div>

        {/* Audit form */}
        <div className="mb-10" data-testid="card-audit-form">
          <form onSubmit={handleSubmit}>
            <div className="flex gap-2 p-1.5 bg-card rounded-2xl border border-border/60 shadow-sm">
              <Input
                type="url"
                placeholder="https://docs.example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={auditMutation.isPending}
                className="flex-1 h-11 border-0 bg-transparent text-base focus-visible:ring-0 focus-visible:ring-offset-0 px-3 placeholder:text-muted-foreground/50"
                data-testid="input-url"
              />
              <Button
                type="submit"
                disabled={auditMutation.isPending}
                className="h-11 px-6 rounded-xl shrink-0"
                data-testid="button-start-audit"
              >
                {auditMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2 opacity-70" />
                    Auditing…
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Analyze
                  </>
                )}
              </Button>
            </div>

            <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
              <div className="flex justify-end mt-2">
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="text-xs text-muted-foreground h-7" data-testid="button-advanced-options">
                    Advanced options {showAdvanced ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent className="pt-3">
                <div className="flex gap-4 items-end">
                  <div className="w-32">
                    <Label htmlFor="maxPages" className="text-xs text-muted-foreground font-medium">Max Pages</Label>
                    <Input
                      id="maxPages"
                      type="number"
                      min="1"
                      max="500"
                      value={maxPages}
                      onChange={(e) => setMaxPages(e.target.value)}
                      disabled={auditMutation.isPending}
                      className="h-9 mt-1 rounded-xl border-border/60 bg-card shadow-sm"
                      data-testid="input-max-pages"
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </form>
        </div>

        {/* Loading */}
        {auditMutation.isPending && (
          <div className="py-20 text-center mb-10">
            <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin mx-auto mb-5" />
            <p className="font-medium text-foreground/80">Crawling and analyzing…</p>
            <p className="text-sm text-muted-foreground mt-1.5">This may take up to a minute</p>
          </div>
        )}

        {/* Recent Audits showcase */}
        {!auditMutation.isPending && (
          <div className="mt-4 space-y-5">
            <h2 className="text-xl font-bold tracking-tight">Recent Audits</h2>
            <Showcase />
          </div>
        )}
      </div>
    </div>
  );
}
