import type { Express, Request, Response } from "express";
import { escapeHtml } from "./og";
import { POSTS, getPost, type Post } from "./content/posts";

export const SITE = {
  name: "AuditDocs",
  tagline: "The AI readiness test for documentation",
  description:
    "AuditDocs is a free tool that tests how ready your documentation is for AI systems — LLMs, answer engines, and agents — and returns a 0–100 score with prioritized fixes.",
  twitter: "@auditdocs",
};

/**
 * Canonical base URL. Prefer BASE_URL (a single pinned production domain) so
 * canonical/sitemap/OG URLs are stable; fall back to the request host only when
 * it is unset (local/dev). IMPORTANT: set BASE_URL in production or canonical
 * tags will reflect whatever host served the request.
 */
export function getBaseUrl(req: Request): string {
  const configured = process.env.BASE_URL;
  if (configured) return configured.replace(/\/$/, "");
  return `${req.protocol}://${req.get("host")}`;
}

function jsonLdScript(obj: unknown): string {
  // JSON.stringify escapes nothing dangerous for a script context except "</".
  const json = JSON.stringify(obj).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}

const STYLES = `
:root{color-scheme:light dark;--bg:#ffffff;--panel:#f7f8fa;--fg:#0b0d12;--muted:#5b6472;--border:#e6e8ec;--accent:#1d4ed8;--accent-fg:#ffffff;--code:#f2f4f7}
@media (prefers-color-scheme:dark){:root{--bg:#0b0d12;--panel:#12151c;--fg:#e8ebf0;--muted:#98a2b3;--border:#232833;--accent:#5b8cff;--accent-fg:#0b0d12;--code:#161a22}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}
.wrap{max-width:760px;margin:0 auto;padding:0 20px}
header.site{border-bottom:1px solid var(--border);position:sticky;top:0;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(8px);z-index:10}
header.site .wrap{display:flex;align-items:center;justify-content:space-between;height:56px}
.brand{font-weight:700;letter-spacing:-.01em;color:var(--fg)}
header.site nav a{color:var(--muted);font-size:14px;font-weight:500;margin-left:18px}
header.site nav a:hover{color:var(--fg);text-decoration:none}
main{padding:44px 0 64px}
.kicker{font:600 12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;text-transform:uppercase;letter-spacing:.14em;color:var(--muted);margin:0 0 12px}
h1{font-size:2rem;line-height:1.18;letter-spacing:-.02em;margin:0 0 10px}
.meta{color:var(--muted);font-size:13px;margin:0 0 28px}
h2{font-size:1.4rem;letter-spacing:-.01em;margin:2.2em 0 .6em;padding-top:.2em}
h3{font-size:1.12rem;margin:1.7em 0 .4em}
p,li{color:var(--fg)}
.lede{font-size:1.12rem;color:var(--fg)}
.muted{color:var(--muted)}
ul,ol{padding-left:1.25em}
li{margin:.3em 0}
.tldr{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:16px 18px;margin:0 0 28px}
.tldr .l{font:600 11px/1 ui-monospace,monospace;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin:0 0 6px}
.tldr p{margin:0}
.facts{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:16px 18px 16px 38px;margin:24px 0}
.facts li{margin:.4em 0}
.cta{display:flex;flex-wrap:wrap;gap:14px 20px;align-items:center;justify-content:space-between;background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:20px 22px;margin:34px 0}
.cta-kicker{font:600 11px/1 ui-monospace,monospace;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin:0 0 6px}
.cta-title{font-weight:700;margin:0 0 4px}
.cta-sub{color:var(--muted);font-size:14px;margin:0;max-width:42ch}
.cta-btn{background:var(--accent);color:var(--accent-fg);padding:11px 18px;border-radius:9px;font-weight:600;font-size:14px;white-space:nowrap}
.cta-btn:hover{text-decoration:none;opacity:.92}
table.bands{width:100%;border-collapse:collapse;margin:12px 0;font-size:14px}
table.bands th,table.bands td{border:1px solid var(--border);padding:8px 12px;text-align:left}
table.bands th{background:var(--panel)}
blockquote.cite{border-left:3px solid var(--accent);background:var(--panel);margin:14px 0;padding:12px 16px;border-radius:0 8px 8px 0;font-size:14px;color:var(--muted)}
.faq{margin-top:8px}
.faq h3{margin:1.3em 0 .2em;font-size:1.02rem}
.faq p{color:var(--muted);margin:.2em 0 0}
.postlist{list-style:none;padding:0;margin:24px 0}
.postlist li{border:1px solid var(--border);border-radius:12px;padding:18px 20px;margin:0 0 14px}
.postlist a.t{font-size:1.12rem;font-weight:650;color:var(--fg)}
.postlist p{color:var(--muted);font-size:14px;margin:6px 0 0}
footer.site{border-top:1px solid var(--border);color:var(--muted);font-size:13px;padding:26px 0}
footer.site a{color:var(--muted)}
footer.site .wrap{display:flex;flex-wrap:wrap;gap:8px 18px;justify-content:space-between}
`;

interface ShellOpts {
  baseUrl: string;
  path: string; // absolute path, e.g. "/blog/foo"
  title: string; // full <title>
  description: string;
  jsonLd?: unknown[];
  bodyHtml: string;
  articleTitle?: string; // rendered as H1 if present
  kicker?: string;
  metaLine?: string; // date · reading time, etc.
}

function renderShell(o: ShellOpts): string {
  const canonical = `${o.baseUrl}${o.path}`;
  const ogImage = `${o.baseUrl}/og-image.png`;
  const jsonLd = (o.jsonLd || []).map(jsonLdScript).join("");
  const h1 = o.articleTitle
    ? `${o.kicker ? `<p class="kicker">${escapeHtml(o.kicker)}</p>` : ""}<h1>${escapeHtml(
        o.articleTitle,
      )}</h1>${o.metaLine ? `<p class="meta">${escapeHtml(o.metaLine)}</p>` : ""}`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(o.title)}</title>
<meta name="description" content="${escapeHtml(o.description)}">
<link rel="canonical" href="${escapeHtml(canonical)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta name="theme-color" content="#1d4ed8">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${escapeHtml(SITE.name)}">
<meta property="og:title" content="${escapeHtml(o.title)}">
<meta property="og:description" content="${escapeHtml(o.description)}">
<meta property="og:url" content="${escapeHtml(canonical)}">
<meta property="og:image" content="${escapeHtml(ogImage)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(o.title)}">
<meta name="twitter:description" content="${escapeHtml(o.description)}">
<meta name="twitter:image" content="${escapeHtml(ogImage)}">
<style>${STYLES}</style>
${jsonLd}
</head>
<body>
<header class="site"><div class="wrap"><a class="brand" href="/">AuditDocs</a><nav><a href="/blog">Guides</a><a href="/">Run an audit</a></nav></div></header>
<main><div class="wrap">${h1}${o.bodyHtml}</div></main>
<footer class="site"><div class="wrap"><span>© 2026 AuditDocs · ${escapeHtml(
    SITE.tagline,
  )}</span><span><a href="/">Checker</a> · <a href="/blog">Guides</a> · <a href="/llms.txt">llms.txt</a></span></div></footer>
</body>
</html>`;
}

/* ---------- JSON-LD builders ---------- */

function orgAndSite(baseUrl: string) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE.name,
      url: baseUrl,
      description: SITE.description,
      logo: `${baseUrl}/logo-mark.svg`,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE.name,
      url: baseUrl,
      description: SITE.description,
    },
  ];
}

function breadcrumb(baseUrl: string, items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${baseUrl}${it.path}`,
    })),
  };
}

function faqPage(post: Post) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: post.faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

function articleLd(baseUrl: string, post: Post) {
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: post.title,
    description: post.description,
    datePublished: post.datePublished,
    dateModified: post.dateModified,
    author: { "@type": "Organization", name: SITE.name, url: baseUrl },
    publisher: {
      "@type": "Organization",
      name: SITE.name,
      logo: { "@type": "ImageObject", url: `${baseUrl}/logo-mark.svg` },
    },
    mainEntityOfPage: `${baseUrl}/blog/${post.slug}`,
    keywords: post.keywords.join(", "),
    image: `${baseUrl}/og-image.png`,
  };
}

/* ---------- HTML fragments ---------- */

function factsBlock(facts: string[]): string {
  return `<ul class="facts">${facts.map((f) => `<li>${f}</li>`).join("")}</ul>`;
}

function faqBlock(post: Post): string {
  return `<h2 id="faq">Frequently asked questions</h2><div class="faq">${post.faq
    .map((f) => `<h3>${escapeHtml(f.q)}</h3><p>${escapeHtml(f.a)}</p>`)
    .join("")}</div>`;
}

function renderPost(baseUrl: string, post: Post): string {
  const body = `
<div class="tldr"><p class="l">TL;DR</p><p>${escapeHtml(post.tldr)}</p></div>
${factsBlock(post.keyFacts)}
${post.bodyHtml}
${faqBlock(post)}`;
  const metaLine = `${new Date(post.datePublished).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })} · ${post.readingMinutes} min read`;
  return renderShell({
    baseUrl,
    path: `/blog/${post.slug}`,
    title: `${post.title} | AuditDocs`,
    description: post.description,
    articleTitle: post.title,
    kicker: "Guide",
    metaLine,
    bodyHtml: body,
    jsonLd: [
      articleLd(baseUrl, post),
      faqPage(post),
      breadcrumb(baseUrl, [
        { name: "Home", path: "/" },
        { name: "Guides", path: "/blog" },
        { name: post.title, path: `/blog/${post.slug}` },
      ]),
    ],
  });
}

function renderBlogIndex(baseUrl: string): string {
  const items = POSTS.map(
    (p) =>
      `<li><a class="t" href="/blog/${p.slug}">${escapeHtml(
        p.title,
      )}</a><p>${escapeHtml(p.description)}</p></li>`,
  ).join("");
  const collection = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "AuditDocs Guides",
    description:
      "Guides on documentation AI readiness — how to make your docs discoverable, readable, and citeable by AI systems.",
    url: `${baseUrl}/blog`,
    hasPart: POSTS.map((p) => ({
      "@type": "TechArticle",
      headline: p.title,
      url: `${baseUrl}/blog/${p.slug}`,
    })),
  };
  const body = `
<p class="lede">Practical, technically accurate guides on making documentation ready for AI systems — LLMs, answer engines, and agents.</p>
<ul class="postlist">${items}</ul>`;
  return renderShell({
    baseUrl,
    path: "/blog",
    title: "Guides: Documentation AI Readiness | AuditDocs",
    description:
      "Guides on documentation AI readiness — how to make your docs discoverable, readable, and citeable by AI systems.",
    articleTitle: "Documentation AI Readiness Guides",
    kicker: "Guides",
    bodyHtml: body,
    jsonLd: [collection, ...orgAndSite(baseUrl), breadcrumb(baseUrl, [
      { name: "Home", path: "/" },
      { name: "Guides", path: "/blog" },
    ])],
  });
}

/* ---------- text assets ---------- */

function robotsTxt(baseUrl: string): string {
  const aiBots = ["GPTBot", "ClaudeBot", "anthropic-ai", "PerplexityBot", "Google-Extended", "CCBot", "Applebot-Extended"];
  const aiSection = aiBots
    .map((b) => `User-agent: ${b}\nAllow: /`)
    .join("\n\n");
  return `# robots.txt — AuditDocs
User-agent: *
Allow: /
Disallow: /api/
Disallow: /analytics

# AI crawlers are explicitly welcome to read our guides.
${aiSection}

Sitemap: ${baseUrl}/sitemap.xml
`;
}

function sitemapXml(baseUrl: string): string {
  const urls: { loc: string; lastmod?: string; priority: string; changefreq: string }[] = [
    { loc: `${baseUrl}/`, priority: "1.0", changefreq: "weekly" },
    { loc: `${baseUrl}/blog`, priority: "0.8", changefreq: "weekly" },
    ...POSTS.map((p) => ({
      loc: `${baseUrl}/blog/${p.slug}`,
      lastmod: p.dateModified,
      priority: "0.9",
      changefreq: "monthly",
    })),
  ];
  const body = urls
    .map(
      (u) =>
        `  <url><loc>${escapeHtml(u.loc)}</loc>${
          u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""
        }<changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`;
}

function llmsTxt(baseUrl: string): string {
  const guides = POSTS.map(
    (p) => `- [${p.title}](${baseUrl}/blog/${p.slug}): ${p.description}`,
  ).join("\n");
  return `# AuditDocs

> ${SITE.description}

AuditDocs scores documentation from 0 to 100 across four equally weighted categories: AI crawl accessibility, structured data and machine readability, content self-containment, and documentation architecture.

## Core
- [AI readiness checker](${baseUrl}/): Run a free audit of any documentation site and get a 0–100 score with prioritized fixes.

## Guides
${guides}

## About
- Topic: documentation AI readiness, LLM-readable docs, AI crawlability, RAG-ready documentation.
- Contact: via ${baseUrl}
`;
}

/* ---------- registration ---------- */

export function registerSeoRoutes(app: Express): void {
  app.get("/robots.txt", (req: Request, res: Response) => {
    res.type("text/plain").send(robotsTxt(getBaseUrl(req)));
  });

  app.get("/sitemap.xml", (req: Request, res: Response) => {
    res.type("application/xml").send(sitemapXml(getBaseUrl(req)));
  });

  app.get("/llms.txt", (req: Request, res: Response) => {
    res.type("text/plain").send(llmsTxt(getBaseUrl(req)));
  });

  app.get("/blog", (req: Request, res: Response) => {
    res.type("html").send(renderBlogIndex(getBaseUrl(req)));
  });

  app.get("/blog/:slug", (req: Request, res: Response, next) => {
    const post = getPost(req.params.slug as string);
    if (!post) return next(); // fall through to SPA 404
    res.type("html").send(renderPost(getBaseUrl(req), post));
  });
}
