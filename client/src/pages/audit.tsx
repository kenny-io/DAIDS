import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, ArrowLeft, Copy, Check, Search } from "lucide-react";
import { AuditResultView } from "@/components/audit-result";
import { useToast } from "@/hooks/use-toast";
import type { AuditResult } from "@shared/audit-types";

function ShareButton() {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast({ title: "Link copied", description: "Share this URL to let others view this audit." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Could not copy", description: "Copy the URL from the address bar.", variant: "destructive" });
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="rounded-xl border-border/60 shadow-sm text-xs h-8 gap-1.5"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied!" : "Copy link"}
    </Button>
  );
}

export default function AuditPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data: result, isLoading, error } = useQuery<AuditResult>({
    queryKey: ["/api/audit", id],
    queryFn: async () => {
      const res = await fetch(`/api/audit/${id}`);
      if (!res.ok) throw new Error("Audit result not found");
      return res.json();
    },
    enabled: !!id,
    retry: false,
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <div className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl overflow-hidden shadow-sm">
              <img src="/logo-mark.svg" alt="AuditDocs" className="h-full w-full" />
            </div>
            <span className="font-semibold text-[15px] tracking-tight">AuditDocs</span>
          </Link>
          <div className="flex items-center gap-2">
            <ShareButton />
            <a
              href="/analytics"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
            >
              <BarChart3 className="w-4 h-4" />
              Analytics
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Back nav */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          All audits
        </Link>

        {/* Loading */}
        {isLoading && (
          <div className="py-24 text-center">
            <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin mx-auto mb-5" />
            <p className="font-medium text-foreground/80">Loading audit…</p>
          </div>
        )}

        {/* Not found */}
        {error && (
          <Card className="rounded-2xl shadow-sm border-border/60 max-w-md mx-auto">
            <CardContent className="py-16 text-center">
              <p className="text-lg font-bold tracking-tight mb-2">Audit not found</p>
              <p className="text-sm text-muted-foreground mb-6">
                This result may have expired or the link may be incorrect.
              </p>
              <Link href="/">
                <Button className="rounded-xl gap-2">
                  <Search className="w-4 h-4" />
                  Run a new audit
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Result */}
        {result && !isLoading && (
          <>
            {/* Shareable URL banner */}
            <div className="flex items-center justify-between mb-6 p-4 rounded-2xl bg-card border border-border/60 shadow-sm">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wide mb-0.5">Shareable audit link</p>
                <p className="text-sm font-mono text-foreground/80 truncate">{window.location.href}</p>
              </div>
              <ShareButton />
            </div>

            <AuditResultView result={result} />

            {/* CTA */}
            <div className="mt-10 pt-8 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-sm">Want to audit your own docs?</p>
                <p className="text-xs text-muted-foreground mt-0.5">Get a score out of 100 with prioritized fixes.</p>
              </div>
              <Link href="/">
                <Button className="rounded-xl gap-2 shrink-0">
                  <Search className="w-4 h-4" />
                  Audit your docs
                </Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
