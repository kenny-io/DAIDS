import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Search, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Clock, FileText, Layers, Target, Code2, Shield, ExternalLink } from "lucide-react";
import type { AuditResult, AuditRequest, Finding, CategoryResult } from "@shared/audit-types";

const categoryIcons: Record<string, typeof Search> = {
  "Agent discovery readiness": Target,
  "Structure and chunkability": Layers,
  "Retrieval self-containment": FileText,
  "Agent usability for developers": Code2,
  "Trust and freshness signals": Shield,
};

function getScoreColor(score: number, max: number): string {
  const percentage = (score / max) * 100;
  if (percentage >= 80) return "text-emerald-500";
  if (percentage >= 60) return "text-amber-500";
  return "text-red-500";
}

function getScoreBgColor(score: number, max: number): string {
  const percentage = (score / max) * 100;
  if (percentage >= 80) return "bg-emerald-500";
  if (percentage >= 60) return "bg-amber-500";
  return "bg-red-500";
}

function getSeverityColor(severity: string): "destructive" | "secondary" | "default" {
  if (severity === "high") return "destructive";
  if (severity === "med") return "secondary";
  return "default";
}

function ScoreCircle({ score }: { score: number }) {
  const color = score >= 80 ? "text-emerald-500" : score >= 60 ? "text-amber-500" : "text-red-500";
  const bgColor = score >= 80 ? "bg-emerald-500/10" : score >= 60 ? "bg-amber-500/10" : "bg-red-500/10";
  
  return (
    <div className={`relative w-32 h-32 rounded-full ${bgColor} flex items-center justify-center`} data-testid="score-circle">
      <svg className="absolute w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-muted/30"
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeDasharray={`${(score / 100) * 283} 283`}
          strokeLinecap="round"
          className={color}
        />
      </svg>
      <div className="text-center z-10">
        <span className={`text-4xl font-bold ${color}`} data-testid="text-overall-score">{score}</span>
        <span className="text-muted-foreground text-sm block">/100</span>
      </div>
    </div>
  );
}

function CategoryCard({ category }: { category: CategoryResult }) {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = categoryIcons[category.name] || Target;
  const scoreColor = getScoreColor(category.score, category.max);
  const progressColor = getScoreBgColor(category.score, category.max);
  const percentage = (category.score / category.max) * 100;

  return (
    <Card className="hover-elevate" data-testid={`card-category-${category.name.toLowerCase().replace(/\s+/g, "-")}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer flex flex-row items-center justify-between gap-4 pb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">{category.name}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Progress value={percentage} className={`w-24 h-1.5 [&>div]:${progressColor}`} />
                  <span className={`text-sm font-semibold ${scoreColor}`}>
                    {category.score}/{category.max}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {category.findings.length > 0 && (
                <Badge variant="secondary">{category.findings.length} issues</Badge>
              )}
              {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {category.findings.length === 0 ? (
              <div className="flex items-center gap-2 text-emerald-500 py-2">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm">No issues found</span>
              </div>
            ) : (
              <div className="space-y-3">
                {category.findings.map((finding, index) => (
                  <FindingItem key={index} finding={finding} />
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function FindingItem({ finding }: { finding: Finding }) {
  const [showUrls, setShowUrls] = useState(false);

  return (
    <div className="border rounded-md p-3 bg-muted/30" data-testid={`finding-${finding.severity}`}>
      <div className="flex items-start gap-2">
        <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
          finding.severity === "high" ? "text-red-500" : 
          finding.severity === "med" ? "text-amber-500" : "text-muted-foreground"
        }`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={getSeverityColor(finding.severity)} className="text-xs">
              {finding.severity === "high" ? "High" : finding.severity === "med" ? "Medium" : "Low"}
            </Badge>
            <span className="text-sm">{finding.message}</span>
          </div>
          {finding.urls.length > 0 && (
            <div className="mt-2">
              <button
                onClick={() => setShowUrls(!showUrls)}
                className="text-xs text-primary hover:underline flex items-center gap-1"
                data-testid="button-toggle-urls"
              >
                {showUrls ? "Hide" : "Show"} affected URLs ({finding.urls.length})
                {showUrls ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {showUrls && (
                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {finding.urls.map((url, idx) => (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 truncate"
                      data-testid={`link-url-${idx}`}
                    >
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{url}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TopFindings({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) return null;

  return (
    <Card data-testid="card-top-findings">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-amber-500" />
          Top Issues to Fix
        </CardTitle>
        <CardDescription>Prioritized list of improvements for better AI discoverability</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {findings.map((finding, index) => (
          <FindingItem key={index} finding={finding} />
        ))}
      </CardContent>
    </Card>
  );
}

function MetaInfo({ result }: { result: AuditResult }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="meta-info">
      <Card className="p-4">
        <div className="text-sm text-muted-foreground">Pages Crawled</div>
        <div className="text-2xl font-bold" data-testid="text-pages-crawled">{result.crawledPages}</div>
      </Card>
      <Card className="p-4">
        <div className="text-sm text-muted-foreground">Chunks Created</div>
        <div className="text-2xl font-bold" data-testid="text-chunk-count">{result.meta.chunkCount}</div>
      </Card>
      <Card className="p-4">
        <div className="text-sm text-muted-foreground flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Duration
        </div>
        <div className="text-2xl font-bold" data-testid="text-duration">{(result.meta.durationMs / 1000).toFixed(1)}s</div>
      </Card>
      <Card className="p-4">
        <div className="text-sm text-muted-foreground">Errors</div>
        <div className={`text-2xl font-bold ${result.meta.errorCount > 0 ? "text-red-500" : ""}`} data-testid="text-error-count">
          {result.meta.errorCount}
        </div>
      </Card>
    </div>
  );
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [maxPages, setMaxPages] = useState("50");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { toast } = useToast();

  const auditMutation = useMutation({
    mutationFn: async (request: AuditRequest) => {
      const response = await apiRequest("POST", "/api/audit", request);
      return response as AuditResult;
    },
    onError: (error: Error) => {
      toast({
        title: "Audit Failed",
        description: error.message,
        variant: "destructive",
      });
    },
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

    auditMutation.mutate({
      url: url.trim(),
      maxPages: parseInt(maxPages, 10) || 50,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Docs AI Discoverability Scorer</h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Audit your documentation for AI agent readiness. Get a score out of 100 and actionable improvements.
          </p>
        </div>

        <Card className="mb-8" data-testid="card-audit-form">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Audit a Documentation Site
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="url">Documentation URL</Label>
                <Input
                  id="url"
                  type="url"
                  placeholder="https://docs.example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={auditMutation.isPending}
                  data-testid="input-url"
                />
              </div>

              <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" data-testid="button-advanced-options">
                    {showAdvanced ? "Hide" : "Show"} advanced options
                    {showAdvanced ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="maxPages">Max Pages</Label>
                      <Input
                        id="maxPages"
                        type="number"
                        min="1"
                        max="500"
                        value={maxPages}
                        onChange={(e) => setMaxPages(e.target.value)}
                        disabled={auditMutation.isPending}
                        data-testid="input-max-pages"
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <Button type="submit" className="w-full" disabled={auditMutation.isPending} data-testid="button-start-audit">
                {auditMutation.isPending ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                    Auditing... This may take a minute
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Start Audit
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {auditMutation.data && (
          <div className="space-y-6 animate-in fade-in duration-500" data-testid="audit-results">
            <Card>
              <CardHeader className="text-center">
                <CardTitle>Audit Results for</CardTitle>
                <a 
                  href={auditMutation.data.rootUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center justify-center gap-1"
                  data-testid="link-audited-url"
                >
                  {auditMutation.data.rootUrl}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                <ScoreCircle score={auditMutation.data.score} />
                {auditMutation.data.meta.jsRenderedWarning && (
                  <div className="mt-4 flex items-center gap-2 text-amber-500 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    JS-rendered docs detected. Some content may not be crawlable.
                  </div>
                )}
              </CardContent>
            </Card>

            <MetaInfo result={auditMutation.data} />

            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Category Scores</h2>
              {auditMutation.data.categories.map((category, index) => (
                <CategoryCard key={index} category={category} />
              ))}
            </div>

            <TopFindings findings={auditMutation.data.topFindings} />
          </div>
        )}
      </div>
    </div>
  );
}
