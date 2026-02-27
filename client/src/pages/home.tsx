import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  return { text: "text-red-600", bg: "bg-red-500", border: "border-red-500" };
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
  const dimensions = size === "large" ? "w-40 h-40" : "w-16 h-16";
  const textSize = size === "large" ? "text-5xl" : "text-lg";
  const strokeWidth = size === "large" ? 8 : 4;

  return (
    <div className={`relative ${dimensions}`} data-testid="score-gauge">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/20"
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={colors.text}
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`${textSize} font-bold ${colors.text}`} data-testid="text-overall-score">
          {score}
        </span>
        {size === "large" && (
          <span className="text-sm text-muted-foreground">{getScoreLabel(score)}</span>
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
          className="group flex items-center gap-4 p-4 rounded-lg border bg-card hover-elevate cursor-pointer"
          data-testid={`category-${category.name.toLowerCase().replace(/\s+/g, "-")}`}
        >
          <div className={`p-2 rounded-lg ${colors.bg}/10`}>
            <Icon className={`w-5 h-5 ${colors.text}`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-medium text-sm">{category.name}</span>
              <div className="flex items-center gap-2">
                {hasIssues && (
                  <Badge variant="secondary" className="text-xs">
                    {issueFindings.length} {issueFindings.length === 1 ? "issue" : "issues"}
                  </Badge>
                )}
                {passFindings.length > 0 && (
                  <Badge variant="secondary" className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                    {passFindings.length} passed
                  </Badge>
                )}
                <span className={`font-semibold text-sm ${colors.text}`}>
                  {category.score}/{category.max}
                </span>
              </div>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full ${colors.bg} transition-all duration-500`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="pl-14 pr-4 pb-4 space-y-2">
          {passFindings.length > 0 && (
            <div className="space-y-2">
              {passFindings.map((finding, idx) => (
                <FindingRow key={`pass-${idx}`} finding={finding} />
              ))}
            </div>
          )}
          {issueFindings.length > 0 && (
            <div className="space-y-2">
              {issueFindings.map((finding, idx) => (
                <FindingRow key={`issue-${idx}`} finding={finding} />
              ))}
            </div>
          )}
          {category.findings.length === 0 && (
            <div className="flex items-center gap-2 py-2 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm">All checks passed</span>
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
    pass: { color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/30", label: "Passed", icon: CheckCircle2 },
    high: { color: "text-red-600", bg: "bg-red-100 dark:bg-red-900/30", label: "High", icon: AlertCircle },
    med: { color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/30", label: "Medium", icon: AlertTriangle },
    low: { color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/30", label: "Low", icon: AlertCircle },
  };
  const config = severityConfig[finding.severity] || severityConfig.low;
  const Icon = config.icon;

  return (
    <div className={`rounded-lg border p-3 ${finding.severity === "pass" ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900" : "bg-muted/30"}`} data-testid={`finding-${finding.severity}`}>
      <div className="flex items-start gap-3">
        <span className={`px-2 py-0.5 rounded text-xs font-medium inline-flex items-center gap-1 ${config.bg} ${config.color}`}>
          <Icon className="w-3 h-3" />
          {config.label}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm">{finding.message}</p>
          {finding.urls.length > 0 && (
            <button
              onClick={() => setShowUrls(!showUrls)}
              className="mt-2 text-xs text-primary hover:underline inline-flex items-center gap-1"
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
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground truncate"
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

function MetricCard({ icon: Icon, label, value, subtext }: { icon: typeof Clock; label: string; value: string | number; subtext?: string }) {
  return (
    <div className="text-center p-4">
      <Icon className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {subtext && <div className="text-xs text-muted-foreground mt-0.5">{subtext}</div>}
    </div>
  );
}

function TopIssues({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) return null;

  const highPriority = findings.filter((f) => f.severity === "high");
  const medPriority = findings.filter((f) => f.severity === "med");

  return (
    <Card data-testid="card-top-issues">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <CardTitle className="text-lg">Priority Fixes</CardTitle>
        </div>
        <CardDescription>Focus on these issues first for maximum impact</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {highPriority.slice(0, 3).map((finding, idx) => (
          <FindingRow key={`high-${idx}`} finding={finding} />
        ))}
        {medPriority.slice(0, 2).map((finding, idx) => (
          <FindingRow key={`med-${idx}`} finding={finding} />
        ))}
      </CardContent>
    </Card>
  );
}

function ShowcaseCard({ entry, onClick }: { entry: AuditAnalyticsEntry; onClick: (id: string) => void }) {
  const colors = getScoreColor(entry.score);
  const date = new Date(entry.createdAt);
  const timeAgo = getTimeAgo(date);

  return (
    <Card 
      className="hover-elevate cursor-pointer transition-colors hover:border-primary/30" 
      data-testid={`showcase-card-${entry.id}`}
      onClick={() => onClick(entry.id)}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <ScoreGauge score={entry.score} size="small" />
            <div className="min-w-0">
              <div className="font-medium text-sm inline-flex items-center gap-1 truncate max-w-full">
                <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{entry.domain}</span>
              </div>
              <div className="text-xs text-muted-foreground truncate mt-1">{entry.url}</div>
            </div>
          </div>
          <Badge 
            variant="secondary" 
            className={`${colors.text} ${colors.bg}/10`}
          >
            {getScoreLabel(entry.score)}
          </Badge>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{entry.crawledPages} pages</span>
          <span>{timeAgo}</span>
        </div>
      </CardContent>
    </Card>
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

function Showcase({ onSelect }: { onSelect: (id: string) => void }) {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<"createdAt" | "score">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data, isLoading } = useQuery<ShowcaseResponse>({
    queryKey: ["/api/showcase", page, sortBy, sortDir],
    queryFn: async () => {
      const query = new URLSearchParams({
        page: String(page),
        limit: "18",
        sortBy,
        sortDir,
      });
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
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-48" />
                  <div className="h-3 bg-muted rounded w-32" />
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
      <Card className="text-center py-8" data-testid="showcase-empty">
        <CardContent>
          <Globe className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No audits yet. Run your first audit above!</p>
        </CardContent>
      </Card>
    );
  }

  const sortedItems = [...data.items].sort((a, b) => {
    if (sortBy === "score") {
      if (a.score !== b.score) {
        return sortDir === "asc" ? a.score - b.score : b.score - a.score;
      }
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return sortDir === "asc" ? aTime - bTime : bTime - aTime;
    }

    const aTime = new Date(a.createdAt).getTime();
    const bTime = new Date(b.createdAt).getTime();
    return sortDir === "asc" ? aTime - bTime : bTime - aTime;
  });

  return (
    <div className="space-y-4" data-testid="showcase-section">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground">
          Showing {data.items.length} of {data.pagination.totalItems} audits
        </div>
        <div className="w-full sm:w-64" data-testid="showcase-sort-select">
          <Select
            value={`${sortBy}:${sortDir}`}
            onValueChange={(value) => {
              const [nextSortBy, nextSortDir] = value.split(":") as ["createdAt" | "score", "asc" | "desc"];
              setSortBy(nextSortBy);
              setSortDir(nextSortDir);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9">
              <div className="inline-flex items-center gap-2">
                <ArrowUpDown className="w-3.5 h-3.5" />
                <SelectValue placeholder="Sort audits" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt:desc">Newest first</SelectItem>
              <SelectItem value="createdAt:asc">Oldest first</SelectItem>
              <SelectItem value="score:desc">Docs score: high to low</SelectItem>
              <SelectItem value="score:asc">Docs score: low to high</SelectItem>
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
        <div className="flex items-center justify-center gap-2" data-testid="showcase-pagination">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => p - 1)}
            disabled={!data.pagination.hasPrev}
            data-testid="button-prev-page"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground px-3">
            Page {data.pagination.page} of {data.pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(p => p + 1)}
            disabled={!data.pagination.hasNext}
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

      toast({ 
        title: "Report exported", 
        description: `${format.toUpperCase()} file downloaded successfully` 
      });
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
        data-testid="button-export-markdown"
      >
        <FileText className="w-4 h-4 mr-2" />
        Markdown
      </Button>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => handleExport("pdf")} 
        disabled={isExporting}
        data-testid="button-export-pdf"
      >
        <Download className="w-4 h-4 mr-2" />
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
      toast({
        title: "Audit Failed",
        description: error.message,
        variant: "destructive",
      });
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
      toast({
        title: "URL Required",
        description: "Please enter a documentation URL to audit",
        variant: "destructive",
      });
      return;
    }

    setSelectedAuditId(null);
    auditMutation.mutate({
      url: url.trim(),
      maxPages: parseInt(maxPages, 10) || 50,
    });
  };

  const handleShowcaseSelect = (id: string) => {
    setSelectedAuditId(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const displayResult = selectedAuditId ? showcaseQuery.data ?? null : auditMutation.data ?? null;
  const isLoadingResult = showcaseQuery.isLoading && !!selectedAuditId;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card/50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg overflow-hidden ring-1 ring-primary/20 shadow-sm">
              <img src="/logo-mark.svg" alt="DAIDS" className="h-full w-full" />
            </div>
            <div>
              <h1 className="font-semibold">DAIDS</h1>
              <p className="text-xs text-muted-foreground">Docs AI Discoverability Scorer</p>
            </div>
          </div>
          <a 
            href="/analytics" 
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            data-testid="link-analytics"
          >
            <BarChart3 className="w-4 h-4" />
            Analytics
          </a>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="text-center mb-6" data-testid="audit-intro">
          <div className="p-4 rounded-full bg-muted/50 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <Search className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Audit Your Documentation</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Analyze how well your docs are optimized for AI agents and retrieval systems, then get prioritized fixes.
          </p>
          <ul className="mt-4 text-sm text-muted-foreground max-w-3xl mx-auto text-left grid gap-1 sm:grid-cols-2">
            <li><strong>Agent discovery readiness</strong> — checks crawl signals like llms.txt, robots rules, and sitemap coverage.</li>
            <li><strong>Structure and chunkability</strong> — checks heading hierarchy, page structure, and chunk-friendly content.</li>
            <li><strong>Retrieval self-containment</strong> — checks whether pages can answer questions without missing context.</li>
            <li><strong>Agent usability for developers</strong> — checks code examples, API references, and implementation guidance.</li>
            <li className="sm:col-span-2"><strong>Trust and freshness signals</strong> — checks metadata quality, maintenance indicators, and reliability cues.</li>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground/80" data-testid="text-fresh-runs-note">
            Every audit run is generated fresh for the current site state, results are not served from cache.
          </p>
        </div>

        <Card className="mb-8" data-testid="card-audit-form">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <Input
                    type="url"
                    placeholder="https://docs.example.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={auditMutation.isPending}
                    className="h-12 text-base"
                    data-testid="input-url"
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={auditMutation.isPending} 
                  className="h-12 px-6"
                  data-testid="button-start-audit"
                >
                  {auditMutation.isPending ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                      Auditing...
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
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="text-xs text-muted-foreground" data-testid="button-advanced-options">
                    Advanced options {showAdvanced ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4">
                  <div className="flex gap-4 items-end">
                    <div className="w-32">
                      <Label htmlFor="maxPages" className="text-xs">Max Pages</Label>
                      <Input
                        id="maxPages"
                        type="number"
                        min="1"
                        max="500"
                        value={maxPages}
                        onChange={(e) => setMaxPages(e.target.value)}
                        disabled={auditMutation.isPending}
                        className="h-9"
                        data-testid="input-max-pages"
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </form>
          </CardContent>
        </Card>

        {(auditMutation.isPending || isLoadingResult) && (
          <Card className="mb-8">
            <CardContent className="py-12 text-center">
              <div className="animate-spin w-8 h-8 border-3 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-muted-foreground">
                {auditMutation.isPending ? "Crawling and analyzing documentation..." : "Loading audit results..."}
              </p>
              {auditMutation.isPending && (
                <p className="text-xs text-muted-foreground mt-1">This may take up to a minute</p>
              )}
            </CardContent>
          </Card>
        )}

        {displayResult && !auditMutation.isPending && (
          <div className="space-y-6 animate-in fade-in duration-300" data-testid="audit-results">
            {selectedAuditId && !auditMutation.data && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedAuditId(null)}
                className="mb-2"
                data-testid="button-back-to-empty"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            )}

            <Card>
              <CardContent className="py-8">
                <div className="flex flex-col md:flex-row items-center gap-8">
                  <ScoreGauge score={displayResult.score} />
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-xl font-semibold mb-1">Audit Complete</h2>
                        <a
                          href={displayResult.rootUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                          data-testid="link-audited-url"
                        >
                          {displayResult.rootUrl}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <ExportButton result={displayResult} />
                    </div>

                    {displayResult.meta.jsRenderedWarning && (
                      <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-amber-500/10 text-amber-600">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm">JS-rendered docs detected. Some content may not be fully indexed.</span>
                      </div>
                    )}

                    <div className="grid grid-cols-4 divide-x">
                      <MetricCard icon={FileText} label="Pages" value={displayResult.crawledPages} />
                      <MetricCard icon={Layers} label="Chunks" value={displayResult.meta.chunkCount} />
                      <MetricCard icon={Clock} label="Duration" value={`${(displayResult.meta.durationMs / 1000).toFixed(1)}s`} />
                      <MetricCard icon={AlertTriangle} label="Errors" value={displayResult.meta.errorCount} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Category Breakdown</h3>
                {displayResult.categories.map((category, index) => (
                  <CategoryScoreBar key={index} category={category} />
                ))}
              </div>

              <div>
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Priority Fixes</h3>
                {displayResult.topFindings.length > 0 ? (
                  <div className="space-y-2">
                    {displayResult.topFindings.slice(0, 5).map((finding, idx) => (
                      <FindingRow key={idx} finding={finding} />
                    ))}
                  </div>
                ) : (
                  <Card className="p-6 text-center">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                    <p className="text-sm font-medium">No critical issues found</p>
                    <p className="text-xs text-muted-foreground mt-1">Your docs are well optimized</p>
                  </Card>
                )}
              </div>
            </div>
          </div>
        )}

        <Separator className="my-8" />

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Recent Audits</h2>
          </div>
          <Showcase onSelect={handleShowcaseSelect} />
        </div>
      </div>
    </div>
  );
}
