import { Resvg } from "@resvg/resvg-js";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function scoreColor(score: number): string {
  if (score >= 80) return "#10b981";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Good";
  if (score >= 50) return "Fair";
  if (score >= 35) return "Needs Work";
  return "Poor";
}

function domainFontSize(domain: string): number {
  if (domain.length > 40) return 38;
  if (domain.length > 30) return 48;
  if (domain.length > 22) return 58;
  return 68;
}

function truncateDomain(domain: string): string {
  if (domain.length > 44) return domain.slice(0, 41) + "…";
  return domain;
}

function buildAuditSvg(domain: string, score: number, crawledPages: number): string {
  const displayDomain = truncateDomain(domain);
  const domainText = escapeXml(displayDomain);
  const fontSize = domainFontSize(displayDomain);
  const color = scoreColor(score);
  const label = scoreLabel(score);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="AuditDocs score for ${domainText}">
  <defs>
    <linearGradient id="bg" x1="140" y1="80" x2="1060" y2="550" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#1d4ed8" />
      <stop offset="0.55" stop-color="#1e3a8a" />
      <stop offset="1" stop-color="#0f172a" />
    </linearGradient>
    <linearGradient id="panel" x1="240" y1="140" x2="960" y2="500" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="rgba(255,255,255,0.16)" />
      <stop offset="1" stop-color="rgba(255,255,255,0.08)" />
    </linearGradient>
    <filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="20" stdDeviation="24" flood-color="#020617" flood-opacity="0.35" />
    </filter>
  </defs>

  <rect width="1200" height="630" fill="#0b1120" />
  <rect x="40" y="40" width="1120" height="550" rx="40" fill="url(#bg)" />
  <rect x="88" y="88" width="1024" height="454" rx="30" fill="url(#panel)" stroke="rgba(255,255,255,0.16)" />

  <!-- Logo icon -->
  <g transform="translate(130 148)" filter="url(#soft-shadow)">
    <rect x="0" y="0" width="130" height="130" rx="30" fill="#0f172a" opacity="0.35" />
    <rect x="10" y="10" width="110" height="110" rx="24" fill="url(#bg)" />
    <rect x="35" y="35" width="46" height="62" rx="9" fill="#ffffff" opacity="0.96" />
    <rect x="43" y="50" width="28" height="5" rx="2.5" fill="#2563eb" />
    <rect x="43" y="60" width="28" height="5" rx="2.5" fill="#2563eb" />
    <rect x="43" y="70" width="20" height="5" rx="2.5" fill="#2563eb" />
    <path d="M89 33L94 43L104 48L94 53L89 63L84 53L74 48L84 43Z" fill="#38bdf8" />
  </g>

  <!-- AuditDocs wordmark -->
  <text x="292" y="192" fill="rgba(255,255,255,0.55)" font-family="Inter, system-ui, sans-serif" font-size="18" font-weight="700" letter-spacing="3">AUDITDOCS</text>

  <!-- Domain name -->
  <text x="130" y="305" fill="#ffffff" font-family="Inter, system-ui, sans-serif" font-size="${fontSize}" font-weight="800" letter-spacing="-1">${domainText}</text>

  <!-- Subtitle -->
  <text x="130" y="368" fill="#bfdbfe" font-family="Inter, system-ui, sans-serif" font-size="26" font-weight="500">AI Discoverability Score</text>

  <!-- Pages info -->
  <text x="130" y="416" fill="rgba(203,213,225,0.65)" font-family="Inter, system-ui, sans-serif" font-size="21">${crawledPages} page${crawledPages === 1 ? "" : "s"} crawled</text>

  <!-- Score ring background -->
  <circle cx="985" cy="315" r="120" fill="rgba(0,0,0,0.30)" />
  <!-- Score ring colored border -->
  <circle cx="985" cy="315" r="110" fill="rgba(255,255,255,0.05)" stroke="${color}" stroke-width="4" />

  <!-- Score number -->
  <text x="985" y="348" fill="${color}" font-family="Inter, system-ui, sans-serif" font-size="92" font-weight="900" text-anchor="middle">${score}</text>

  <!-- /100 label -->
  <text x="985" y="392" fill="rgba(255,255,255,0.45)" font-family="Inter, system-ui, sans-serif" font-size="22" text-anchor="middle" font-weight="400">out of 100</text>

  <!-- Score quality label (below circle) -->
  <text x="985" y="468" fill="${color}" font-family="Inter, system-ui, sans-serif" font-size="19" text-anchor="middle" font-weight="600">${label}</text>
</svg>`;
}

// Simple in-memory cache with 5-minute TTL
const cache = new Map<string, { png: Buffer; at: number }>();
const TTL_MS = 5 * 60 * 1000;

export function generateAuditOgImage(
  id: string,
  domain: string,
  score: number,
  crawledPages: number,
): Buffer {
  const cacheKey = `${id}:${score}:${domain}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.png;

  const svg = buildAuditSvg(domain, score, crawledPages);
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } });
  const png = resvg.render().asPng();

  cache.set(cacheKey, { png, at: Date.now() });
  return png;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
