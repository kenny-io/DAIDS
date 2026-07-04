import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";

/* ---------------------------------------------------------------------------
 * Theme — follows the system preference (applied by a bootstrap script in
 * index.html). No in-app toggle: the app renders in the viewer's OS theme.
 * ------------------------------------------------------------------------- */

/* ---------------------------------------------------------------------------
 * Brand lockup
 * ------------------------------------------------------------------------- */
export function Wordmark({ suffix }: { suffix?: string }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 group">
      <div className="h-7 w-7 rounded-md overflow-hidden ring-1 ring-border shadow-xs">
        <img src="/logo-mark.svg" alt="AuditDocs" className="h-full w-full" />
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-semibold text-[15px] tracking-tight text-foreground">AuditDocs</span>
        {suffix && (
          <span className="hidden sm:inline text-[11px] font-medium text-muted-foreground tracking-tight">{suffix}</span>
        )}
      </div>
    </Link>
  );
}

/* ---------------------------------------------------------------------------
 * Primary navigation
 * ------------------------------------------------------------------------- */
const NAV = [
  { href: "/", label: "Overview" },
];

function NavLinks() {
  const [location] = useLocation();
  const isActive = (href: string) => (href === "/" ? location === "/" : location.startsWith(href));
  // Don't render a link to the page you're already on — a lone self-referential
  // pill (e.g. "Overview" on the homepage) reads as a button that goes nowhere.
  const visible = NAV.filter((item) => !isActive(item.href));
  if (visible.length === 0) return null;

  return (
    <nav className="flex items-center gap-1" aria-label="Primary">
      {visible.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="px-2.5 sm:px-3 h-8 inline-flex items-center rounded-md text-[13px] font-medium transition-colors text-muted-foreground hover:text-foreground hover:bg-muted/60"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/* ---------------------------------------------------------------------------
 * Top navigation bar — used on every page
 * ------------------------------------------------------------------------- */
export function TopNav({
  suffix,
  actions,
  showNav = true,
}: {
  suffix?: string;
  actions?: ReactNode;
  showNav?: boolean;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-panel/80 backdrop-blur-xl supports-[backdrop-filter]:bg-panel/70">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-5 min-w-0">
          <Wordmark suffix={suffix} />
        </div>
        <div className="flex items-center gap-2">
          {showNav && <NavLinks />}
          {showNav && actions && <span className="hidden sm:block h-5 w-px bg-border mx-1" />}
          {actions}
        </div>
      </div>
    </header>
  );
}

/* ---------------------------------------------------------------------------
 * Page shell — consistent max width + vertical rhythm
 * ------------------------------------------------------------------------- */
export function PageContainer({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`max-w-[1200px] mx-auto px-4 sm:px-6 ${className}`}>{children}</div>
  );
}

/* Small-caps monospace section label — the "instrument panel" tell */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground/80 font-medium">
      {children}
    </p>
  );
}
