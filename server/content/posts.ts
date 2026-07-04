// Server-rendered marketing/education content. Each post is emitted as full,
// static HTML at a clean URL (/blog/:slug) — no client JS required to read it,
// so AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended) and search
// engines see the complete content. This is the site practising what it audits.

export interface FaqItem {
  q: string;
  a: string; // plain text (also used to build FAQPage JSON-LD)
}

export interface Post {
  slug: string;
  title: string; // <title> / H1
  description: string; // meta description (<=160 chars ideally)
  keywords: string[];
  datePublished: string; // ISO date
  dateModified: string; // ISO date
  readingMinutes: number;
  /** One-sentence, extractable answer used for the AEO summary and OG. */
  tldr: string;
  /** Bulleted key facts — GEO engines lift these directly. */
  keyFacts: string[];
  faq: FaqItem[];
  /** Main body HTML (semantic; no <h1> — the shell renders the H1 from title). */
  bodyHtml: string;
}

const CTA = `
<aside class="cta" aria-label="Try the checker">
  <div>
    <p class="cta-kicker">Free · No signup</p>
    <p class="cta-title">Test your documentation's AI readiness</p>
    <p class="cta-sub">Get a 0–100 score across four categories, with prioritized fixes — in about a minute.</p>
  </div>
  <a class="cta-btn" href="/">Run a free audit →</a>
</aside>`;

export const POSTS: Post[] = [
  {
    slug: "documentation-ai-readiness",
    title: "Documentation AI Readiness: The Complete Guide (2026)",
    description:
      "What documentation AI readiness means, why it matters for LLMs and AI agents, and how to test and improve it across four measurable categories.",
    keywords: [
      "documentation AI readiness",
      "AI-ready documentation",
      "docs AI readiness check",
      "LLM-ready docs",
      "llms.txt",
      "AI crawlability",
      "RAG documentation",
    ],
    datePublished: "2026-07-04",
    dateModified: "2026-07-04",
    readingMinutes: 9,
    tldr:
      "Documentation AI readiness measures how well your docs can be discovered, crawled, parsed, and cited by AI systems (LLMs, answer engines, and agents). It is assessed across four categories: AI crawl accessibility, structured data and machine readability, content self-containment, and documentation architecture.",
    keyFacts: [
      "AI readiness is distinct from traditional SEO: answer engines and agents often read raw HTML and do not execute JavaScript, so client-rendered content can be invisible to them.",
      "Four measurable pillars determine AI readiness: crawl accessibility, machine readability, content self-containment, and architecture.",
      "An llms.txt file, a valid robots.txt that allows AI crawlers, and a complete sitemap.xml are the fastest wins for discoverability.",
      "Self-contained, well-chunked sections (roughly 50–800 tokens) retrieve far better in RAG and answer-engine pipelines than sprawling walls of text.",
      "JSON-LD structured data and a linked OpenAPI spec let agents understand your content without scraping HTML.",
    ],
    faq: [
      {
        q: "What is documentation AI readiness?",
        a: "Documentation AI readiness is a measure of how easily AI systems — large language models, AI answer engines, and autonomous agents — can discover, crawl, parse, retrieve, and correctly cite your documentation. It spans discoverability (can crawlers find and access the pages), machine readability (is the content structured and parseable without executing JavaScript), self-containment (does each section stand on its own for retrieval), and architecture (is the information hierarchy clear).",
      },
      {
        q: "How is AI readiness different from SEO?",
        a: "Traditional SEO optimizes for search-engine ranking, where Googlebot renders JavaScript and evaluates links and keywords. AI readiness optimizes for answer engines and agents, many of which read raw HTML, prefer structured and self-contained content, and reward machine-readable signals like llms.txt, JSON-LD, and OpenAPI specs. Good SEO helps, but a site can rank well and still be poorly readable by LLMs.",
      },
      {
        q: "Do AI crawlers execute JavaScript?",
        a: "Most do not. Crawlers such as GPTBot, ClaudeBot, PerplexityBot, and Google-Extended generally fetch and parse raw HTML rather than running a full browser. If your documentation renders its content client-side with JavaScript, those crawlers may see an empty page, which is why server-rendered or static HTML is strongly preferred for AI readiness.",
      },
      {
        q: "What is llms.txt and do I need it?",
        a: "llms.txt is a plain-text file at the root of your site that gives AI systems a curated, machine-readable map of your most important content. It is an emerging convention analogous to robots.txt and sitemap.xml, but aimed at LLMs. It is one of the highest-leverage, lowest-effort improvements for documentation AI readiness.",
      },
      {
        q: "How do I check my documentation's AI readiness?",
        a: "Run an automated audit that crawls your docs and scores them across the four categories. AuditDocs does this for free and returns a 0–100 score with prioritized, specific fixes.",
      },
    ],
    bodyHtml: `
<p class="lede">Documentation <strong>AI readiness</strong> measures how well your docs can be discovered, crawled, parsed, retrieved, and cited by AI systems — large language models, AI answer engines, and autonomous agents. As more developers ask an assistant instead of reading a page, AI-readable documentation is becoming as important as human-readable documentation.</p>

<p>This guide explains what AI readiness is, why it now matters, and the four measurable categories that determine it — the same categories the <a href="/">AuditDocs checker</a> scores.</p>

<h2 id="why-it-matters">Why AI readiness matters now</h2>
<p>Two shifts changed the stakes for documentation:</p>
<ul>
  <li><strong>Answer engines replaced some search.</strong> Tools like ChatGPT, Claude, Perplexity, and Google's AI overviews synthesize answers and cite sources. If your docs are readable and structured, you get cited; if not, a competitor does.</li>
  <li><strong>Agents read docs to act.</strong> Coding assistants and autonomous agents fetch documentation to complete tasks. They reward machine-readable formats (JSON-LD, OpenAPI) and self-contained content, and they punish JavaScript-gated pages.</li>
</ul>
<p>The critical difference from SEO: <strong>most AI crawlers do not execute JavaScript.</strong> A docs site that renders content client-side can rank in Google yet be nearly invisible to an LLM crawler. AI readiness closes that gap.</p>

<h2 id="four-pillars">The four pillars of AI-ready documentation</h2>
<p>AI readiness breaks down into four categories, each contributing 25% of an overall score.</p>

<h3 id="crawl-accessibility">1. AI crawl accessibility</h3>
<p>Can AI systems find and fetch your pages at all? This covers the discovery layer:</p>
<ul>
  <li><strong>llms.txt</strong> — a curated map of your key content for LLMs.</li>
  <li><strong>robots.txt</strong> that explicitly allows AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended) rather than blocking them.</li>
  <li><strong>sitemap.xml</strong> that covers your whole documentation set.</li>
  <li><strong>No JavaScript gating</strong> — the content must be present in the initial HTML response.</li>
</ul>

<h3 id="machine-readability">2. Structured data &amp; machine readability</h3>
<p>Once a page is fetched, can a machine understand it without scraping prose?</p>
<ul>
  <li><strong>JSON-LD structured data</strong> with documentation-specific types (TechArticle, HowTo, APIReference, FAQPage).</li>
  <li><strong>A linked OpenAPI/Swagger spec</strong> for API docs — the gold standard for agents, which can parse every endpoint without guessing.</li>
</ul>

<h3 id="self-containment">3. Content self-containment</h3>
<p>Retrieval systems split pages into chunks and pull the most relevant ones in isolation. Content is "self-contained" when each section makes sense on its own:</p>
<ul>
  <li><strong>Well-sized chunks</strong> — roughly 50–800 tokens per section. Too short and the chunk lacks context; too long and retrieval gets imprecise.</li>
  <li><strong>Substantial content per page</strong> — thin or near-empty pages carry little signal.</li>
  <li><strong>Minimal external dependency</strong> — a section shouldn't require three other pages to make sense.</li>
</ul>

<h3 id="architecture">4. Documentation architecture</h3>
<p>Clear structure helps both humans and machines navigate:</p>
<ul>
  <li><strong>A single, descriptive H1</strong> per page and a logical H2/H3 hierarchy.</li>
  <li><strong>Descriptive titles</strong> and consistent internal linking.</li>
  <li><strong>Navigable depth</strong> — important pages shouldn't be buried.</li>
</ul>

${CTA}

<h2 id="checklist">A quick AI-readiness checklist</h2>
<ol>
  <li>Publish an <strong>llms.txt</strong> at your site root.</li>
  <li>Confirm <strong>robots.txt</strong> allows AI crawlers and links your sitemap.</li>
  <li>Ship a complete <strong>sitemap.xml</strong>.</li>
  <li>Serve documentation content as <strong>server-rendered or static HTML</strong>, not JavaScript-only.</li>
  <li>Add <strong>JSON-LD</strong> with documentation-specific types.</li>
  <li>Link an <strong>OpenAPI spec</strong> if you have an API.</li>
  <li>Break long pages into <strong>self-contained sections</strong> with clear headings.</li>
  <li>Give every page one clear <strong>H1</strong> and a logical heading hierarchy.</li>
</ol>

<h2 id="mistakes">Common mistakes that hurt AI readiness</h2>
<ul>
  <li><strong>Client-side-only rendering.</strong> The single biggest issue — the content isn't in the HTML.</li>
  <li><strong>Blocking AI crawlers in robots.txt</strong> without meaning to.</li>
  <li><strong>One giant page per topic</strong> with no headings — retrieval can't isolate answers.</li>
  <li><strong>No structured data</strong>, forcing machines to guess a page's purpose.</li>
</ul>

<p>Want the specifics for your site? The <a href="/">free AuditDocs checker</a> crawls your docs and returns a scored, prioritized report. For exactly how the score is computed, see the <a href="/blog/ai-readiness-scoring-methodology">scoring methodology</a>.</p>
`,
  },
  {
    slug: "ai-readiness-scoring-methodology",
    title: "How AuditDocs Scores Documentation AI Readiness",
    description:
      "The AuditDocs methodology: four equally weighted categories, a 0–100 score, and the specific checks behind documentation AI readiness. Transparent and citeable.",
    keywords: [
      "AI readiness score",
      "documentation scoring methodology",
      "docs AI readiness framework",
      "how to score AI readiness",
      "AuditDocs methodology",
    ],
    datePublished: "2026-07-04",
    dateModified: "2026-07-04",
    readingMinutes: 6,
    tldr:
      "AuditDocs scores documentation from 0 to 100 across four equally weighted categories — AI crawl accessibility, structured data and machine readability, content self-containment, and documentation architecture — each worth 25% of the final score.",
    keyFacts: [
      "The score runs 0–100 and is the normalized sum of four categories, each worth a maximum of 20 points (25% each).",
      "Categories: AI crawl accessibility, structured data and machine readability, content self-containment, and documentation architecture.",
      "Score bands: 90+ Excellent, 70–89 Good, 50–69 Needs work, below 50 Poor.",
      "Findings are graded by severity (high, medium, low) and paired with specific, actionable fixes.",
      "The audit crawls multiple pages of a documentation site rather than judging a single URL.",
    ],
    faq: [
      {
        q: "How is the AI readiness score calculated?",
        a: "Each of the four categories is scored out of 20 points, for a maximum of 80. That total is normalized to a 0–100 scale, so every category contributes 25% of the final score. Points are deducted for specific issues, weighted by severity.",
      },
      {
        q: "What are the four scoring categories?",
        a: "AI crawl accessibility (discovery and fetchability: llms.txt, robots.txt, sitemap, and whether content requires JavaScript), structured data and machine readability (JSON-LD and linked OpenAPI specs), content self-containment (chunk sizing and per-page substance for retrieval), and documentation architecture (heading hierarchy, titles, and navigation).",
      },
      {
        q: "What score is considered good?",
        a: "A score of 90 or above is Excellent, 70 to 89 is Good, 50 to 69 Needs work, and below 50 is Poor. Most documentation sites land in the 70s or low 80s and improve quickly by adding an llms.txt, fixing crawler access, and adding structured data.",
      },
      {
        q: "Can I cite this framework?",
        a: "Yes. The four-category framework and scoring bands are documented here specifically so they can be referenced. See the citation block on this page.",
      },
    ],
    bodyHtml: `
<p class="lede">AuditDocs scores documentation from <strong>0 to 100</strong> across <strong>four equally weighted categories</strong>. This page documents exactly how that works — the categories, the weighting, the checks, and the score bands — so the framework is transparent and citeable.</p>

<h2 id="how-scoring-works">How the score is calculated</h2>
<p>Each category is scored out of a maximum of <strong>20 points</strong> (four categories → 80 points), then normalized to a 0–100 scale. The practical effect is that <strong>each category contributes 25%</strong> of the final score. Within a category, points are deducted for specific issues, weighted by severity — <em>high</em>, <em>medium</em>, or <em>low</em> — and every deduction comes with a concrete fix.</p>
<p>The audit crawls <strong>multiple pages</strong> of a documentation site, not a single URL, so the score reflects the site as a whole.</p>

<h2 id="categories">The four categories</h2>

<h3 id="cat-crawl">AI crawl accessibility — 25%</h3>
<p>Whether AI systems can discover and fetch your content. Representative checks: presence of an <strong>llms.txt</strong>, a <strong>robots.txt</strong> that allows AI crawlers and links a sitemap, a <strong>sitemap.xml</strong> with good coverage, and whether pages depend on <strong>JavaScript</strong> to render their content.</p>

<h3 id="cat-machine">Structured data &amp; machine readability — 25%</h3>
<p>Whether machines can parse your pages without scraping prose. Representative checks: <strong>JSON-LD</strong> coverage and the use of documentation-specific schema types (TechArticle, HowTo, APIReference), and — for API docs — a linked <strong>OpenAPI/Swagger</strong> specification.</p>

<h3 id="cat-self">Content self-containment — 25%</h3>
<p>Whether retrieval systems can pull useful, self-standing chunks. Representative checks: <strong>chunk sizing</strong> (sections that are neither too short nor too long, roughly 50–800 tokens), and whether pages carry <strong>substantial content</strong> rather than thin stubs.</p>

<h3 id="cat-arch">Documentation architecture — 25%</h3>
<p>Whether the information hierarchy is clear. Representative checks: a single descriptive <strong>H1</strong> per page, a logical <strong>H2/H3</strong> structure, descriptive <strong>titles</strong>, and sensible navigation and depth.</p>

<h2 id="bands">Score bands</h2>
<table class="bands">
  <thead><tr><th>Score</th><th>Band</th><th>What it means</th></tr></thead>
  <tbody>
    <tr><td>90–100</td><td><strong>Excellent</strong></td><td>Strong AI readiness; minor polish only.</td></tr>
    <tr><td>70–89</td><td><strong>Good</strong></td><td>Solid foundation with clear, high-value fixes.</td></tr>
    <tr><td>50–69</td><td><strong>Needs work</strong></td><td>Meaningful gaps limiting AI discoverability.</td></tr>
    <tr><td>0–49</td><td><strong>Poor</strong></td><td>Fundamental issues; likely invisible to AI systems.</td></tr>
  </tbody>
</table>

${CTA}

<h2 id="cite">Citing this framework</h2>
<p>The four-category AI-readiness framework and score bands are published here to be referenced. Suggested citation:</p>
<blockquote class="cite">
  AuditDocs. "How AuditDocs Scores Documentation AI Readiness." AuditDocs, 2026. Documentation AI readiness is assessed across four equally weighted categories — AI crawl accessibility, structured data and machine readability, content self-containment, and documentation architecture — producing a 0–100 score.
</blockquote>

<p>New to the topic? Start with the <a href="/blog/documentation-ai-readiness">complete guide to documentation AI readiness</a>, or <a href="/">run a free audit</a> to see your own score.</p>
`,
  },
];

export function getPost(slug: string): Post | undefined {
  return POSTS.find((p) => p.slug === slug);
}
