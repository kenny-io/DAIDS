import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Search,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Layers,
  Target,
  Code2,
  Shield,
  Download,
  ExternalLink,
  BarChart3,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Globe,
  ArrowUpDown,
} from "lucide-react";
import type { AuditResult, AuditRequest, Finding, CategoryResult } from "@shared/audit-types";
import type { AuditAnalyticsEntry, ShowcaseResponse } from "@shared/analytics-types";

const categoryIcons: Record<string, typeof Search> = {
  "Agent discovery readiness": Target,
  "Structure and chunkability": Layers,
  "Retrieval self-containment": FileText,
  "Agent usability for developers": Code2,
  "Trust and freshness signals": Shield,
};

function getScoreColor(score: number): { text: string; bg: string; border: string } {
  if (score >= 90) return { text: "text-emerald-600", bg: "bg-emerald-500", border: "border-emerald-500" };
  if (score >= 50) return { text: "text-amber-600", bg: "bg-amber-500", border: "border-amber-500" };
  return { text: "text-red-500", bg: "bg-red-500", border: "border-red-500" };
}

function getScoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Needs Work";
  return "Poor";
}

function ScoreGauge({ score, size = "large" }: { score: number; size?: "large" | "small" }) {
  const colors = getScoreColor(score);
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const dimensions = size === "large" ? "w-36 h-36" : "w-14 h-14";
  const textSize = size === "large" ? "text-4xl" : "text-base";
  const strokeWidth = size === "large" ? 7 : 4;

  return (
    <div className={`relative ${dimensions} shrink-0`} data-testid="score-gauge">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-muted/40" />
        <circle
          cx="50" cy="50" r="45" fill="none" stroke="currentColor"
          strokeWidth={strokeWidth} strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset} strokeLinecap="round"
          className={colors.text}
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`${textSize} font-bold tabular-nums ${colors.text}`} data-testid="text-overall-score">
          {score}
        </span>
        {size === "large" && (
          <span className="text-xs text-muted-foreground mt-0.5 font-medium">{getScoreLabel(score)}</span>
        )}
      </div>
    </div>
  );
}

function CategoryScoreBar({ category }: { category: CategoryResult }) {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = categoryIcons[category.name] || Target;
  const percentage = Math.round((category.score / category.max) * 100);
  const colors = getScoreColor(percentage);
  const issueFindings = category.findings.filter(f => f.severity !== "pass");
  const passFindings = category.findings.filter(f => f.severity === "pass");
  const hasIssues = issueFindings.length > 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div
          className="group flex items-center gap-4 p-5 rounded-2xl border border-border/60 bg-card shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
          data-testid={`category-${category.name.toLowerCase().replace(/\s+/g, "-")}`}
        >
          <div className="p-2.5 rounded-xl bg-muted shrink-0">
            <Icon className={`w-4 h-4 ${colors.text}`} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-sm">{category.name}</span>
              <div className="flex items-center gap-2.5">
                {hasIssues && (
                  <span className="text-xs text-muted-foreground">
                    {issueFindings.length} {issueFindings.length === 1 ? "issue" : "issues"}
                  </span>
                )}
                {passFindings.length > 0 && !hasIssues && (
                  <span className="text-xs text-emerald-600 font-medium">{passFindings.length} passed</span>
                )}
                <span className={`font-semibold text-sm tabular-nums ${colors.text}`}>
                  {category.score}/{category.max}
                </span>
              </div>
            </div>
            <div className="h-1 bg-muted/60 rounded-full overflow-hidden">
              <div
                className={`h-full ${colors.bg} transition-all duration-700 ease-out`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          <ChevronDown className={`w-4 h-4 text-muted-foreground/50 transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="px-5 pb-4 pt-2 space-y-2">
          {passFindings.map((finding, idx) => (
            <FindingRow key={`pass-${idx}`} finding={finding} />
          ))}
          {issueFindings.map((finding, idx) => (
            <FindingRow key={`issue-${idx}`} finding={finding} />
          ))}
          {category.findings.length === 0 && (
            <div className="flex items-center gap-2 py-3 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm font-medium">All checks passed</span>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function FindingRow({ finding }: { finding: Finding }) {
  const [showUrls, setShowUrls] = useState(false);
  const severityConfig = {
    pass: { color: "text-emerald-600", bg: "bg-emerald-50/60 dark:bg-emerald-950/20", border: "border-emerald-100/80 dark:border-emerald-900/40", label: "Passed", icon: CheckCircle2 },
    high: { color: "text-red-500", bg: "bg-card", border: "border-border/50", label: "High", icon: AlertCircle },
    med: { color: "text-amber-600", bg: "bg-card", border: "border-border/50", label: "Medium", icon: AlertTriangle },
    low: { color: "text-blue-500", bg: "bg-card", border: "border-border/50", label: "Low", icon: AlertCircle },
  };
  const config = severityConfig[finding.severity] || severityConfig.low;
  const Icon = config.icon;

  return (
    <div className={`rounded-xl border ${config.border} ${config.bg} p-4`} data-testid={`finding-${finding.severity}`}>
      <div className="flex items-start gap-3">
        <span className={`shrink-0 mt-0.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${config.color} border border-current/20 bg-current/5`}>
          <Icon className="w-3 h-3" />
          {config.label}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm leading-relaxed">{finding.message}</p>
          {finding.urls.length > 0 && (
            <button
              onClick={() => setShowUrls(!showUrls)}
              className="mt-2 text-xs text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1 font-medium"
              data-testid="button-toggle-urls"
            >
              {showUrls ? "Hide" : "Show"} {finding.urls.length} affected URLs
              {showUrls ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
          {showUrls && (
            <div className="mt-2 space-y-1 text-xs max-h-32 overflow-y-auto">
              {finding.urls.map((url, idx) => (
                <a
                  key={idx}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors truncate"
                  data-testid={`link-url-${idx}`}
                >
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{url}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { icon: typeof Clock; label: string; value: string | number; subtext?: string }) {
  return (
    <div className="text-center px-4 py-3">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5 font-medium">{label}</div>
    </div>
  );
}

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

function ShowcaseCard({ entry, onClick }: { entry: AuditAnalyticsEntry; onClick: (id: string) => void }) {
  const colors = getScoreColor(entry.score);
  const date = new Date(entry.createdAt);
  const timeAgo = getTimeAgo(date);

  return (
    <Card
      className="cursor-pointer bg-card shadow-sm border-border/60 hover:shadow-md transition-all duration-200 rounded-2xl"
      data-testid={`showcase-card-${entry.id}`}
      onClick={() => onClick(entry.id)}
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
          <span className={`text-xs font-semibold ${colors.text}`}>{getScoreLabel(entry.score)}</span>
        </div>
        <div className="text-xs text-muted-foreground/60">{timeAgo}</div>
      </CardContent>
    </Card>
  );
}

function Showcase({ onSelect }: { onSelect: (id: string) => void }) {
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
          <ShowcaseCard key={entry.id} entry={entry} onClick={onSelect} />
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

function ExportButton({ result }: { result: AuditResult }) {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleExport = async (format: "markdown" | "pdf") => {
    setIsExporting(true);
    try {
      const response = await fetch(`/api/export/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-report-${new Date().toISOString().split("T")[0]}.${format === "pdf" ? "pdf" : "md"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({ title: "Report exported", description: `${format.toUpperCase()} downloaded successfully` });
    } catch (error) {
      toast({ title: "Export failed", description: "Could not generate report", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleExport("markdown")}
        disabled={isExporting}
        className="rounded-xl border-border/60 shadow-sm text-xs h-8"
        data-testid="button-export-markdown"
      >
        <FileText className="w-3.5 h-3.5 mr-1.5" />
        Markdown
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleExport("pdf")}
        disabled={isExporting}
        className="rounded-xl border-border/60 shadow-sm text-xs h-8"
        data-testid="button-export-pdf"
      >
        <Download className="w-3.5 h-3.5 mr-1.5" />
        PDF
      </Button>
    </div>
  );
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [maxPages, setMaxPages] = useState("50");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const auditMutation = useMutation({
    mutationFn: async (request: AuditRequest) => {
      const response = await apiRequest("POST", "/api/audit", request);
      return await response.json() as AuditResult;
    },
    onSuccess: () => {
      setUrl("");
      setSelectedAuditId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/showcase"] });
    },
    onError: (error: Error) => {
      toast({ title: "Audit Failed", description: error.message, variant: "destructive" });
    },
  });

  const showcaseQuery = useQuery<AuditResult>({
    queryKey: ["/api/audit", selectedAuditId],
    queryFn: async () => {
      const res = await fetch(`/api/audit/${selectedAuditId}`);
      if (!res.ok) throw new Error("Audit result not found");
      return res.json();
    },
    enabled: !!selectedAuditId,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      toast({ title: "URL Required", description: "Please enter a documentation URL to audit", variant: "destructive" });
      return;
    }
    setSelectedAuditId(null);
    auditMutation.mutate({ url: url.trim(), maxPages: parseInt(maxPages, 10) || 50 });
  };

  const handleShowcaseSelect = (id: string) => {
    setSelectedAuditId(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const displayResult = selectedAuditId ? showcaseQuery.data ?? null : auditMutation.data ?? null;
  const isLoadingResult = showcaseQuery.isLoading && !!selectedAuditId;

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar — frosted glass */}
      <div className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl overflow-hidden shadow-sm">
              <img src="/logo-mark.svg" alt="AuditDocs" className="h-full w-full" />
            </div>
            <span className="font-semibold text-[15px] tracking-tight">AuditDocs</span>
          </div>
          <a
            href="/analytics"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
            data-testid="link-analytics"
          >
            <BarChart3 className="w-4 h-4" />
            Analytics
          </a>
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

        {/* Audit form — search-bar style */}
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

        {/* Loading state */}
        {(auditMutation.isPending || isLoadingResult) && (
          <div className="py-20 text-center mb-10">
            <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin mx-auto mb-5" />
            <p className="font-medium text-foreground/80">
              {auditMutation.isPending ? "Crawling and analyzing…" : "Loading audit results…"}
            </p>
            {auditMutation.isPending && (
              <p className="text-sm text-muted-foreground mt-1.5">This may take up to a minute</p>
            )}
          </div>
        )}

        {/* Results */}
        {displayResult && !auditMutation.isPending && (
          <div className="space-y-6 animate-in fade-in duration-300" data-testid="audit-results">
            {selectedAuditId && !auditMutation.data && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedAuditId(null)}
                className="mb-2 -ml-1 text-muted-foreground hover:text-foreground"
                data-testid="button-back-to-empty"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            )}

            {/* Score summary card */}
            <Card className="rounded-2xl shadow-sm border-border/60 bg-card">
              <CardContent className="py-8 px-8">
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <ScoreGauge score={displayResult.score} />

                  <div className="flex-1 w-full">
                    <div className="flex items-start justify-between mb-5">
                      <div>
                        <h2 className="text-2xl font-bold tracking-tight mb-1">Audit Complete</h2>
                        <a
                          href={displayResult.rootUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1 font-medium"
                          data-testid="link-audited-url"
                        >
                          {displayResult.rootUrl}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <ExportButton result={displayResult} />
                    </div>

                    {displayResult.meta.jsRenderedWarning && (
                      <div className="flex items-center gap-2 mb-5 p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 text-amber-700 dark:text-amber-400">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span className="text-sm">JS-rendered docs detected — some content may not be fully indexed.</span>
                      </div>
                    )}

                    <div className="grid grid-cols-4 divide-x divide-border/60 bg-muted/40 rounded-xl overflow-hidden">
                      <MetricCard icon={FileText} label="Pages" value={displayResult.crawledPages} />
                      <MetricCard icon={Layers} label="Chunks" value={displayResult.meta.chunkCount} />
                      <MetricCard icon={Clock} label="Duration" value={`${(displayResult.meta.durationMs / 1000).toFixed(1)}s`} />
                      <MetricCard icon={AlertTriangle} label="Errors" value={displayResult.meta.errorCount} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Categories + Priority */}
            <div className="grid md:grid-cols-3 gap-5">
              <div className="md:col-span-2 space-y-3">
                <p className="text-sm font-semibold text-muted-foreground/70 tracking-tight">Category Breakdown</p>
                {displayResult.categories.map((category, index) => (
                  <CategoryScoreBar key={index} category={category} />
                ))}
              </div>

              <div>
                <p className="text-sm font-semibold text-muted-foreground/70 tracking-tight mb-3">Priority Fixes</p>
                {displayResult.topFindings.length > 0 ? (
                  <div className="space-y-2">
                    {displayResult.topFindings.slice(0, 5).map((finding, idx) => (
                      <FindingRow key={idx} finding={finding} />
                    ))}
                  </div>
                ) : (
                  <Card className="p-6 text-center rounded-2xl shadow-sm border-border/60">
                    <CheckCircle2 className="w-7 h-7 mx-auto mb-2 text-emerald-500" />
                    <p className="text-sm font-semibold">No critical issues</p>
                    <p className="text-xs text-muted-foreground mt-1">Your docs are well optimized</p>
                  </Card>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Recent Audits */}
        <div className="mt-14 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight">Recent Audits</h2>
          </div>
          <Showcase onSelect={handleShowcaseSelect} />
        </div>
      </div>
    </div>
  );
}
