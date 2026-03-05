import { Resvg } from "@resvg/resvg-js";
import fs from "fs";
import https from "https";
import path from "path";

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
  if (domain.length > 40) return 36;
  if (domain.length > 30) return 46;
  if (domain.length > 22) return 56;
  return 66;
}

function truncateDomain(domain: string): string {
  if (domain.length > 44) return domain.slice(0, 41) + "…";
  return domain;
}

const INTER_WOFF2_URL =
  "https://fonts.gstatic.com/s/inter/v20/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa25L7SUc.woff2";

let _fontPromise: Promise<Buffer | null> | null = null;

async function loadFont(): Promise<Buffer | null> {
  // 1. Try disk (prod: dist/inter.woff2, dev: server/inter.woff2)
  const candidates = [
    path.join(__dirname, "inter.woff2"),
    path.join(process.cwd(), "server", "inter.woff2"),
    path.join(process.cwd(), "dist", "inter.woff2"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      console.log("[og] font loaded from disk:", p);
      return fs.readFileSync(p);
    }
  }
  console.log("[og] font not on disk, candidates tried:", candidates);
  console.log("[og] downloading Inter from CDN...");

  // 2. Download from Google CDN as fallback
  try {
    const buf = await new Promise<Buffer>((resolve, reject) => {
      https.get(INTER_WOFF2_URL, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`font download returned ${res.statusCode}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (d: Buffer) => chunks.push(d));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      }).on("error", reject);
    });
    console.log("[og] font downloaded from CDN:", buf.length, "bytes");
    // Persist next to the bundle for future requests
    const savePath = candidates[0];
    try {
      fs.writeFileSync(savePath, buf);
      console.log("[og] font cached to disk:", savePath);
    } catch {
      // Non-fatal — might lack write perms, continue with in-memory buf
    }
    return buf;
  } catch (err) {
    console.error("[og] font download failed, text will not render:", err);
    return null;
  }
}

function getFont(): Promise<Buffer | null> {
  if (!_fontPromise) _fontPromise = loadFont();
  return _fontPromise;
}

let _bgDataUri: string | undefined = undefined;

function getBgDataUri(): string {
  if (_bgDataUri !== undefined) return _bgDataUri;
  // Prod: __dirname = dist/, image lands at dist/public/baseog.png via Vite build
  // Dev: running from project root, image at client/public/baseog.png
  const candidates = [
    path.join(__dirname, "public", "baseog.png"),
    path.join(process.cwd(), "client", "public", "baseog.png"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const b64 = fs.readFileSync(p).toString("base64");
      _bgDataUri = `data:image/png;base64,${b64}`;
      return _bgDataUri;
    }
  }
  // Fallback: no background image found
  _bgDataUri = "";
  return _bgDataUri;
}

function buildAuditSvg(domain: string, score: number, crawledPages: number): string {
  const displayDomain = truncateDomain(domain);
  const domainText = escapeXml(displayDomain);
  const fontSize = domainFontSize(displayDomain);
  const color = scoreColor(score);
  const label = scoreLabel(score);
  const bgUri = getBgDataUri();

  const bgLayer = bgUri
    ? `<image href="${bgUri}" x="0" y="0" width="1200" height="630" preserveAspectRatio="xMidYMid slice"/>`
    : `<rect width="1200" height="630" fill="#0d1b3e"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="AuditDocs score for ${domainText}">
  <defs>
    <linearGradient id="scoreGlow" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${color}" stop-opacity="0.25"/>
      <stop offset="1" stop-color="${color}" stop-opacity="0.05"/>
    </linearGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Background image -->
  ${bgLayer}

  <!-- Dark overlay to ensure readability -->
  <rect width="1200" height="630" fill="rgba(4,12,28,0.52)"/>

  <!-- Main card -->
  <rect x="52" y="48" width="1096" height="534" rx="20" fill="#080f1f" fill-opacity="0.90" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>

  <!-- Top bar: logo + brand -->
  <!-- Icon box -->
  <rect x="88" y="84" width="44" height="44" rx="10" fill="#1e3a8a"/>
  <rect x="98" y="94" width="24" height="30" rx="4" fill="#ffffff" fill-opacity="0.95"/>
  <rect x="102" y="100" width="14" height="2.5" rx="1.2" fill="#2563eb"/>
  <rect x="102" y="105" width="14" height="2.5" rx="1.2" fill="#2563eb"/>
  <rect x="102" y="110" width="10" height="2.5" rx="1.2" fill="#2563eb"/>
  <!-- Spark icon on top right of icon box -->
  <path d="M122 87 L125 93 L131 96 L125 99 L122 105 L119 99 L113 96 L119 93 Z" fill="#38bdf8" fill-opacity="0.9"/>

  <!-- Brand name -->
  <text x="144" y="113" fill="rgba(255,255,255,0.90)" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="700" letter-spacing="0.5">AuditDocs</text>

  <!-- Divider line -->
  <line x1="88" y1="148" x2="1112" y2="148" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>

  <!-- Category label -->
  <text x="88" y="208" fill="#38bdf8" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="700" letter-spacing="3">AI DISCOVERABILITY AUDIT</text>

  <!-- Domain name -->
  <text x="88" y="295" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="${fontSize}" font-weight="800" letter-spacing="-0.5">${domainText}</text>

  <!-- Description line -->
  <text x="88" y="352" fill="rgba(148,163,184,0.9)" font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="400">Audited ${crawledPages} page${crawledPages === 1 ? "" : "s"} for AI discoverability</text>

  <!-- Score section (right side) -->
  <!-- Outer glow ring -->
  <circle cx="960" cy="320" r="112" fill="url(#scoreGlow)" filter="url(#glow)"/>
  <!-- Ring track -->
  <circle cx="960" cy="320" r="100" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="6"/>
  <!-- Colored ring -->
  <circle cx="960" cy="320" r="100" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round"
    stroke-dasharray="${Math.round(score * 6.28)},628" transform="rotate(-90 960 320)"/>

  <!-- Score number -->
  <text x="960" y="350" fill="${color}" font-family="system-ui, -apple-system, sans-serif" font-size="88" font-weight="900" text-anchor="middle">${score}</text>
  <!-- out of 100 -->
  <text x="960" y="382" fill="rgba(255,255,255,0.38)" font-family="system-ui, -apple-system, sans-serif" font-size="18" text-anchor="middle">out of 100</text>

  <!-- Score label badge -->
  <rect x="${960 - 52}" y="436" width="104" height="30" rx="15" fill="${color}" fill-opacity="0.18" stroke="${color}" stroke-opacity="0.4" stroke-width="1"/>
  <text x="960" y="456" fill="${color}" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="700" text-anchor="middle" letter-spacing="1">${label.toUpperCase()}</text>

  <!-- Footer divider -->
  <line x1="88" y1="535" x2="1112" y2="535" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>

  <!-- Footer left: site name -->
  <text x="88" y="563" fill="rgba(255,255,255,0.30)" font-family="system-ui, -apple-system, sans-serif" font-size="15">auditdocs.io</text>

  <!-- Footer right: tagline -->
  <text x="1112" y="563" fill="rgba(255,255,255,0.30)" font-family="system-ui, -apple-system, sans-serif" font-size="15" text-anchor="end">AI Discoverability Audit</text>
</svg>`;
}

/** Kick off font + bg image loading at server startup so the first OG request is fast. */
export function warmOgAssets(): void {
  getFont(); // starts the async font load/download
  getBgDataUri(); // loads the background image synchronously
}

// Simple in-memory cache with 5-minute TTL
const cache = new Map<string, { png: Buffer; at: number }>();
const TTL_MS = 5 * 60 * 1000;

export async function generateAuditOgImage(
  id: string,
  domain: string,
  score: number,
  crawledPages: number,
): Promise<Buffer> {
  const cacheKey = `${id}:${score}:${domain}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.png;

  const svg = buildAuditSvg(domain, score, crawledPages);
  const fontBuf = await getFont();
  console.log("[og] rendering", domain, "score:", score, "font:", fontBuf ? `${fontBuf.length}b` : "none");
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 1200 },
    font: fontBuf
      ? { fontDatabases: [fontBuf], loadSystemFonts: false, defaultFontFamily: "Inter" }
      : { loadSystemFonts: true },
  });
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
