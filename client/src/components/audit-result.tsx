import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
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
  AlertCircle,
} from "lucide-react";
import type { AuditResult, Finding, CategoryResult } from "@shared/audit-types";
import { useToast } from "@/hooks/use-toast";

const categoryIcons: Record<string, typeof Target> = {
  "Agent discovery readiness": Target,
  "Structure and chunkability": Layers,
  "Retrieval self-containment": FileText,
  "Agent usability for developers": Code2,
  "Trust and freshness signals": Shield,
};

export function getScoreColor(score: number): { text: string; bg: string; border: string } {
  if (score >= 90) return { text: "text-emerald-600", bg: "bg-emerald-500", border: "border-emerald-500" };
  if (score >= 50) return { text: "text-amber-600", bg: "bg-amber-500", border: "border-amber-500" };
  return { text: "text-red-500", bg: "bg-red-500", border: "border-red-500" };
}

export function getScoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Needs Work";
  return "Poor";
}

export function ScoreGauge({ score, size = "large" }: { score: number; size?: "large" | "small" }) {
  const colors = getScoreColor(score);
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const dimensions = size === "large" ? "w-36 h-36" : "w-14 h-14";
  const textSize = size === "large" ? "text-4xl" : "text-base";
  const strokeWidth = size === "large" ? 7 : 4;

  const minWidth = dimensions.concat // we need to use minWidth later to calculate the dimensions.

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



export function FindingRow({ finding }: { finding: Finding }) {
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

export function CategoryScoreBar({ category }: { category: CategoryResult }) {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = categoryIcons[category.name] || Target;
  const percentage = Math.round((category.score / category.max) * 100);
  const colors = getScoreColor(percentage);
  const issueFindings = category.findings.filter(f => f.severity !== "pass");
  const passFindings = category.findings.filter(f => f.severity === "pass");

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden" data-testid={`category-${category.name.toLowerCase().replace(/\s+/g, "-")}`}>
      <button
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="p-2.5 rounded-xl bg-muted shrink-0">
          <Icon className={`w-4 h-4 ${colors.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-sm">{category.name}</span>
            <div className="flex items-center gap-2.5">
              {issueFindings.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {issueFindings.length} {issueFindings.length === 1 ? "issue" : "issues"}
                </span>
              )}
              {passFindings.length > 0 && issueFindings.length === 0 && (
                <span className="text-xs text-emerald-600 font-medium">{passFindings.length} passed</span>
              )}
              <span className={`font-semibold text-sm tabular-nums ${colors.text}`}>
                {category.score}/{category.max}
              </span>
            </div>
          </div>
          <div className="h-1 bg-muted/60 rounded-full overflow-hidden">
            <div className={`h-full ${colors.bg} transition-all duration-700 ease-out`} style={{ width: `${percentage}%` }} />
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground/50 transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="px-5 pb-4 pt-1 space-y-2 border-t border-border/40 bg-muted/10">
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
      )}
    </div>
  );
}

export function MetricCard({ icon: _icon, label, value }: { icon: typeof Clock; label: string; value: string | number; subtext?: string }) {
  return (
    <div className="text-center px-4 py-3">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5 font-medium">{label}</div>
    </div>
  );
}

export function ExportButton({ result }: { result: AuditResult }) {
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
    } catch {
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

export function AuditResultView({ result }: { result: AuditResult }) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300" data-testid="audit-results">
      {/* Score summary */}
      <Card className="rounded-2xl shadow-sm border-border/60 bg-card">
        <CardContent className="py-8 px-8">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <ScoreGauge score={result.score} />
            <div className="flex-1 w-full">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight mb-1">Audit Complete</h2>
                  <a
                    href={result.rootUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1 font-medium"
                    data-testid="link-audited-url"
                  >
                    {result.rootUrl}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <ExportButton result={result} />
              </div>

              {result.meta.jsRenderedWarning && (
                <div className="flex items-center gap-2 mb-5 p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 text-amber-700 dark:text-amber-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="text-sm">JS-rendered docs detected — some content may not be fully indexed.</span>
                </div>
              )}

              <div className="grid grid-cols-4 divide-x divide-border/60 bg-muted/40 rounded-xl overflow-hidden">
                <MetricCard icon={FileText} label="Pages" value={result.crawledPages} />
                <MetricCard icon={Layers} label="Chunks" value={result.meta.chunkCount} />
                <MetricCard icon={Clock} label="Duration" value={`${(result.meta.durationMs / 1000).toFixed(1)}s`} />
                <MetricCard icon={AlertTriangle} label="Errors" value={result.meta.errorCount} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categories + Priority */}
      <div className="grid md:grid-cols-3 gap-5">
        <div className="md:col-span-2 space-y-3">
          <p className="text-sm font-semibold text-muted-foreground/70 tracking-tight">Category Breakdown</p>
          {result.categories.map((category, index) => (
            <CategoryScoreBar key={index} category={category} />
          ))}
        </div>
        <div>
          <p className="text-sm font-semibold text-muted-foreground/70 tracking-tight mb-3">Priority Fixes</p>
          {result.topFindings.length > 0 ? (
            <div className="space-y-2">
              {result.topFindings.slice(0, 5).map((finding, idx) => (
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
  );
}
