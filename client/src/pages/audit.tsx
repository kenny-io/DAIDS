import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Copy, Check, Search } from "lucide-react";
import { AuditResultView } from "@/components/audit-result";
import { TopNav, PageContainer } from "@/components/app-chrome";
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
    <Button variant="outline" size="sm" onClick={handleCopy} className="h-8 text-xs gap-1.5">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied" : "Copy link"}
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
      <TopNav suffix="AI readiness" actions={<ShareButton />} />

      <PageContainer className="py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          All audits
        </Link>

        {isLoading && (
          <div className="py-24 text-center">
            <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin mx-auto mb-5" />
            <p className="font-medium text-foreground/80">Loading audit…</p>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-border bg-card shadow-sm max-w-md mx-auto py-16 px-6 text-center">
            <p className="text-lg font-semibold tracking-tight mb-2">Audit not found</p>
            <p className="text-sm text-muted-foreground mb-6">
              This result may have expired or the link may be incorrect.
            </p>
            <Link href="/">
              <Button className="gap-2">
                <Search className="w-4 h-4" />
                Run a new audit
              </Button>
            </Link>
          </div>
        )}

        {result && !isLoading && (
          <>
            <AuditResultView result={result} />

            <div className="mt-10 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-sm">Want to audit your own docs?</p>
                <p className="text-xs text-muted-foreground mt-0.5">Get a score out of 100 with prioritized fixes.</p>
              </div>
              <Link href="/">
                <Button className="gap-2 shrink-0">
                  <Search className="w-4 h-4" />
                  Audit your docs
                </Button>
              </Link>
            </div>
          </>
        )}
      </PageContainer>
    </div>
  );
}
