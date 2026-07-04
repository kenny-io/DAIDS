import { useState } from "react";
import {
  Globe,
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
  Boxes,
  ShieldAlert,
  MinusCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/app-chrome";
import type { AuditResult, Finding, CategoryResult } from "@shared/audit-types";
import { useToast } from "@/hooks/use-toast";

export function SiteFavicon({ domain, size = "md" }: { domain: string; size?: "sm" | "md" }) {
  const [failed, setFailed] = useState(false);
  const px = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  if (failed) return <Globe className={`${px} shrink-0 text-muted-foreground`} />;
  return (
    <img
      src={`https://www.google.com/s2/favicons?sz=32&domain_url=${encodeURIComponent(domain)}`}
      alt=""
      className={`${px} shrink-0 rounded-sm object-contain`}
      onError={() => setFailed(true)}
    />
  );
}

const categoryIcons: Record<string, typeof Target> = {
  "AI Crawl Accessibility": Target,
  "Structured Data & Machine Readability": Code2,
  "Content Self-Containment": FileText,
  "Documentation Architecture": Layers,
  "Trust and Freshness Signals": Shield,
  // legacy aliases
  "Agent discovery readiness": Target,
  "Structure and chunkability": Layers,
  "Retrieval self-containment": FileText,
  "Agent usability for developers": Code2,
  "Trust and freshness signals": Shield,
};

/* ---------------------------------------------------------------------------
 * Score tone — single source of semantic color
 * ------------------------------------------------------------------------- */
export interface ScoreTone {
  text: string;
  track: string;
  badge: string;
  ring: string;
}

export function scoreTone(score: number): ScoreTone {
  // Bands follow the Lighthouse convention (the audit-industry standard):
  // 90–100 green, 50–89 amber, 0–49 red.
  if (score >= 90)
    return {
      text: "text-emerald-600 dark:text-emerald-400",
      track: "bg-emerald-500",
      ring: "text-emerald-500",
      badge:
        "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/25",
    };
  if (score >= 50)
    return {
      text: "text-amber-600 dark:text-amber-400",
      track: "bg-amber-500",
      ring: "text-amber-500",
      badge:
        "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-400/25",
    };
  return {
    text: "text-red-600 dark:text-red-400",
    track: "bg-red-500",
    ring: "text-red-500",
    badge:
      "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-400/25",
  };
}

// Back-compat shim
export function getScoreColor(score: number): { text: string; bg: string; border: string } {
  const t = scoreTone(score);
  return { text: t.text, bg: t.track, border: t.track };
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
}

export function getScoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Needs work";
  return "Poor";
}

/* Compact numeric score chip for tables / cards */
export function ScoreBadge({ score, className = "" }: { score: number; className?: string }) {
  const t = scoreTone(score);
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[2.25rem] h-6 px-1.5 rounded-md text-[13px] font-semibold font-mono tabular-nums ring-1 ring-inset ${t.badge} ${className}`}
      data-testid="score-badge"
    >
      {score}
    </span>
  );
}

export function ScoreGauge({ score, size = "large" }: { score: number; size?: "large" | "small" }) {
  const tone = scoreTone(score);
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const dimensions = size === "large" ? "w-32 h-32" : "w-12 h-12";
  const textSize = size === "large" ? "text-3xl" : "text-sm";
  const strokeWidth = size === "large" ? 6 : 5;

  return (
    <div className={`relative ${dimensions} shrink-0`} data-testid="score-gauge">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-muted" />
        <circle
          cx="50" cy="50" r="45" fill="none" stroke="currentColor"
          strokeWidth={strokeWidth} strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset} strokeLinecap="round"
          className={tone.ring}
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`${textSize} font-semibold font-mono tabular-nums ${tone.text}`} data-testid="text-overall-score">
          {score}
        </span>
        {size === "large" && (
          <span className="text-[11px] text-muted-foreground mt-0.5 font-medium">{getScoreLabel(score)}</span>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Severity badge — HubSpot-style impact chip
 * ------------------------------------------------------------------------- */
const severityConfig = {
  pass: {
    label: "Pass",
    icon: CheckCircle2,
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/25",
    accent: "border-l-emerald-500",
  },
  high: {
    label: "High",
    icon: ShieldAlert,
    chip: "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-400/25",
    accent: "border-l-red-500",
  },
  med: {
    label: "Medium",
    icon: AlertTriangle,
    chip: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-400/25",
    accent: "border-l-amber-500",
  },
  low: {
    label: "Low",
    icon: AlertCircle,
    chip: "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-400/25",
    accent: "border-l-blue-500",
  },
  na: {
    label: "N/A",
    icon: MinusCircle,
    chip: "bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-400 dark:ring-slate-400/25",
    accent: "border-l-slate-300 dark:border-l-slate-600",
  },
} as const;

export function SeverityBadge({ severity }: { severity: Finding["severity"] }) {
  const cfg = severityConfig[severity] || severityConfig.low;
  const Icon = cfg.icon;
  return (
    <span
      className={`shrink-0 inline-flex items-center gap-1 px-1.5 h-5 rounded text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${cfg.chip}`}
    >
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

export function FindingRow({ finding }: { finding: Finding }) {
  const [showUrls, setShowUrls] = useState(false);

  return (
    <div
      className="rounded-md border border-border bg-card p-3.5"
      data-testid={`finding-${finding.severity}`}
    >
      <div className="flex items-start gap-2.5">
        <SeverityBadge severity={finding.severity} />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] leading-relaxed text-foreground/90">{finding.message}</p>
          {finding.urls.length > 0 && (
            <button
              onClick={() => setShowUrls(!showUrls)}
              className="mt-2 text-xs text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1 font-medium"
              data-testid="button-toggle-urls"
            >
              {showUrls ? "Hide" : "Show"} {finding.urls.length} affected URL{finding.urls.length === 1 ? "" : "s"}
              {showUrls ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
          {showUrls && (
            <div className="mt-2 space-y-1 text-xs max-h-32 overflow-y-auto rounded-md border border-border bg-muted/30 p-2">
              {finding.urls.map((url, idx) => (
                <a
                  key={idx}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors truncate font-mono"
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
  const tone = scoreTone(percentage);
  const issueFindings = category.findings.filter((f) => f.severity !== "pass" && f.severity !== "na");
  const passFindings = category.findings.filter((f) => f.severity === "pass");
  const naFindings = category.findings.filter((f) => f.severity === "na");

  return (
    <div
      className="rounded-lg border border-border bg-card overflow-hidden"
      data-testid={`category-${category.name.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <button
        className="w-full flex items-center gap-3.5 p-4 text-left hover:bg-muted/40 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center justify-center w-9 h-9 rounded-md bg-muted border border-border shrink-0">
          <Icon className={`w-4 h-4 ${tone.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-1.5">
            <span className="font-medium text-[13px] truncate">{category.name}</span>
            <div className="flex items-center gap-2.5 shrink-0">
              {issueFindings.length > 0 ? (
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {issueFindings.length} {issueFindings.length === 1 ? "issue" : "issues"}
                </span>
              ) : passFindings.length > 0 ? (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium tabular-nums">
                  {passFindings.length} passed
                </span>
              ) : null}
              <span className={`font-semibold text-[13px] font-mono tabular-nums ${tone.text}`}>
                {category.score}<span className="text-muted-foreground/50">/{category.max}</span>
              </span>
            </div>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className={`h-full ${tone.track} rounded-full transition-all duration-700 ease-out`} style={{ width: `${percentage}%` }} />
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground/60 transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="px-4 pb-4 pt-3 space-y-2 border-t border-border bg-muted/20">
          {issueFindings.map((finding, idx) => (
            <FindingRow key={`issue-${idx}`} finding={finding} />
          ))}
          {passFindings.map((finding, idx) => (
            <FindingRow key={`pass-${idx}`} finding={finding} />
          ))}
          {naFindings.map((finding, idx) => (
            <FindingRow key={`na-${idx}`} finding={finding} />
          ))}
          {category.findings.length === 0 ? (
            <div className="flex items-center gap-2 py-1.5 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="text-[13px] font-medium">All checks passed</span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/* KPI tile used in the report summary band */
export function MetricTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted border border-border shrink-0 text-muted-foreground">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div className="text-lg font-semibold font-mono tabular-nums leading-none">{value}</div>
        <div className="text-[11px] text-muted-foreground mt-1 font-medium">{label}</div>
      </div>
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
        className="h-8 text-xs gap-1.5"
        data-testid="button-export-markdown"
      >
        <FileText className="w-3.5 h-3.5" />
        Markdown
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleExport("pdf")}
        disabled={isExporting}
        className="h-8 text-xs gap-1.5"
        data-testid="button-export-pdf"
      >
        <Download className="w-3.5 h-3.5" />
        PDF
      </Button>
    </div>
  );
}

export function AuditResultView({ result }: { result: AuditResult }) {
  const issueCount = result.categories.reduce(
    (acc, c) => acc + c.findings.filter((f) => f.severity !== "pass" && f.severity !== "na").length,
    0,
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300" data-testid="audit-results">
      {/* Summary band */}
      <section className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {/* header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-border">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <SiteFavicon domain={result.rootUrl} size="md" />
              <span className="font-semibold text-sm truncate">{safeHostname(result.rootUrl)}</span>
            </div>
            <a
              href={result.rootUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1 font-mono truncate"
              data-testid="link-audited-url"
            >
              {result.rootUrl}
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          </div>
          <ExportButton result={result} />
        </div>

        <div className="flex flex-col md:flex-row items-stretch">
          {/* gauge */}
          <div className="flex flex-col items-center justify-center gap-2 px-8 py-6 md:border-r border-b md:border-b-0 border-border md:w-64 shrink-0">
            <ScoreGauge score={result.score} />
            <div className="text-center">
              <SectionLabel>AI Readiness</SectionLabel>
            </div>
          </div>

          {/* metrics */}
          <div className="flex-1 flex flex-col justify-center">
            {result.meta.jsRenderedWarning && (
              <div className="flex items-center gap-2 m-4 mb-0 p-2.5 rounded-md bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 text-amber-700 dark:text-amber-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="text-xs">JS-rendered docs detected — some content may not be fully indexed.</span>
              </div>
            )}
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-border">
              <MetricTile icon={FileText} label="Pages crawled" value={result.crawledPages} />
              <MetricTile icon={Boxes} label="Chunks" value={result.meta.chunkCount} />
              <MetricTile icon={Clock} label="Duration" value={`${(result.meta.durationMs / 1000).toFixed(1)}s`} />
              <MetricTile icon={AlertTriangle} label="Issues found" value={issueCount} />
            </div>
          </div>
        </div>
      </section>

      {/* Categories + Priority */}
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <SectionLabel>Category breakdown</SectionLabel>
            <span className="text-[11px] text-muted-foreground tabular-nums">{result.categories.length} categories</span>
          </div>
          {result.categories.map((category, index) => (
            <CategoryScoreBar key={index} category={category} />
          ))}
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionLabel>Priority fixes</SectionLabel>
            {result.topFindings.length > 0 && (
              <span className="text-[11px] text-muted-foreground tabular-nums">Top {Math.min(5, result.topFindings.length)}</span>
            )}
          </div>
          {result.topFindings.length > 0 ? (
            <div className="space-y-2">
              {result.topFindings.slice(0, 5).map((finding, idx) => (
                <FindingRow key={idx} finding={finding} />
              ))}
            </div>
          ) : (
            <div className="p-6 text-center rounded-lg border border-border bg-card">
              <CheckCircle2 className="w-7 h-7 mx-auto mb-2 text-emerald-500" />
              <p className="text-sm font-semibold">No critical issues</p>
              <p className="text-xs text-muted-foreground mt-1">Your docs are well optimized.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
