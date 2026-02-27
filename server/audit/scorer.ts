import type {
  ExtractedPage,
  ContentChunk,
  CategoryResult,
  Finding,
  FindingSeverity,
  AIDiscoveryFiles,
} from "./types";

const MAX_CATEGORY_SCORE = 20;
const TOP_URLS_LIMIT = 10;

function createFinding(
  severity: FindingSeverity,
  message: string,
  urls: string[] = [],
  detail?: string
): Finding {
  const finding: Finding = {
    severity,
    message,
    urls: urls.slice(0, TOP_URLS_LIMIT),
  };
  if (detail) finding.detail = detail;
  return finding;
}

function scoreAICrawlAccessibility(
  aiFiles: AIDiscoveryFiles,
  pages: ExtractedPage[]
): CategoryResult {
  const findings: Finding[] = [];
  let score = MAX_CATEGORY_SCORE;

  if (!aiFiles.llmsTxt.exists) {
    score -= 6;
    findings.push(
      createFinding(
        "high",
        "No llms.txt file found. This file helps AI agents understand your site structure and content.",
        [],
        "llms.txt is a plain-text file placed at the root of your domain (e.g. example.com/llms.txt) that tells AI agents what your product is, where key documentation lives, and what use cases it serves. Without it, AI crawlers have to guess your site's structure. Creating one is simple — it's just a text file with a product description, links to important doc sections, and common use cases. See llmstxt.org for the specification."
      )
    );
  } else {
    let llmsTxtIssues = 0;
    if (!aiFiles.llmsTxt.hasProductDescription) {
      score -= 2;
      llmsTxtIssues++;
      findings.push(
        createFinding(
          "med",
          "llms.txt exists but lacks a clear product description.",
          [],
          "Your llms.txt file should start with a concise description of what your product does. This helps AI agents understand the context of your documentation and provide more accurate recommendations. Add 1-3 sentences at the top describing your product's purpose and key capabilities."
        )
      );
    }
    if (!aiFiles.llmsTxt.hasDocumentationLinks) {
      score -= 2;
      llmsTxtIssues++;
      findings.push(
        createFinding(
          "med",
          "llms.txt should include links to key documentation sections.",
          [],
          "AI agents use llms.txt as a table of contents. Without links, they can't efficiently navigate to the right documentation sections. Add URLs to your most important pages — getting started guides, API references, tutorials, and configuration docs. This dramatically reduces the number of pages an AI needs to crawl to find relevant information."
        )
      );
    }
    if (!aiFiles.llmsTxt.hasUseCases) {
      score -= 1;
      llmsTxtIssues++;
      findings.push(
        createFinding(
          "low",
          "llms.txt should describe common use cases for better AI recommendations.",
          [],
          "Including use cases in your llms.txt helps AI agents match user questions to relevant documentation. For example, 'Use case: Authentication — see /docs/auth' helps an AI agent know exactly where to look when a user asks about authentication. List your 3-5 most common use cases with pointers to the relevant docs."
        )
      );
    }
    if (llmsTxtIssues === 0) {
      findings.push(
        createFinding(
          "pass",
          "llms.txt file found with product description, documentation links, and use cases."
        )
      );
    }
  }

  if (!aiFiles.robotsTxt.exists) {
    score -= 3;
    findings.push(
      createFinding(
        "med",
        "No robots.txt file found. AI crawlers need clear access rules.",
        [],
        "robots.txt is a standard file that tells web crawlers which pages they can and cannot access. Without one, AI crawlers may index content you don't want indexed, or may be overly cautious and skip your docs entirely. Create a robots.txt at your site root with explicit rules for AI user agents like GPTBot, Claude-Web, and Amazonbot. A simple 'User-agent: * Allow: /' is a good starting point."
      )
    );
  } else {
    let robotsTxtIssues = 0;
    if (aiFiles.robotsTxt.blocksAICrawlers) {
      score -= 4;
      robotsTxtIssues++;
      findings.push(
        createFinding(
          "high",
          "robots.txt blocks AI crawlers (GPTBot, Claude-Web, etc). Your content won't be indexed by AI agents.",
          [],
          "Your robots.txt currently disallows access for AI-specific crawlers. This means AI assistants like ChatGPT, Claude, and others cannot read your documentation, making it invisible in AI-generated answers. If this is intentional for certain sections, consider allowing access to your public documentation while blocking sensitive areas. Add explicit 'Allow' rules for GPTBot, Claude-Web, and other AI user agents for your documentation paths."
        )
      );
    } else if (!aiFiles.robotsTxt.allowsAICrawlers && aiFiles.robotsTxt.aiCrawlerRules.length === 0) {
      score -= 1;
      robotsTxtIssues++;
      findings.push(
        createFinding(
          "low",
          "robots.txt doesn't explicitly allow AI crawlers. Consider adding rules for GPTBot, Claude-Web, etc.",
          [],
          "While your robots.txt doesn't block AI crawlers, it also doesn't explicitly allow them. Some AI crawlers are conservative and may not index your content without explicit permission. Adding specific user-agent rules like 'User-agent: GPTBot Allow: /' signals that your documentation is AI-friendly and should be indexed."
        )
      );
    }
    if (!aiFiles.robotsTxt.mentionsSitemap) {
      score -= 1;
      robotsTxtIssues++;
      findings.push(
        createFinding(
          "low",
          "robots.txt should reference your sitemap.xml for better crawl discovery.",
          [],
          "Adding a 'Sitemap: https://yourdomain.com/sitemap.xml' line to your robots.txt helps crawlers discover your sitemap automatically. This is especially useful for AI crawlers that start by reading robots.txt — they'll immediately know where to find your complete page listing without having to guess the sitemap location."
        )
      );
    }
    if (robotsTxtIssues === 0) {
      findings.push(
        createFinding(
          "pass",
          "robots.txt properly configured with AI crawler access rules and sitemap reference."
        )
      );
    }
  }

  if (!aiFiles.sitemap.exists) {
    score -= 4;
    findings.push(
      createFinding(
        "high",
        "No sitemap.xml found. AI crawlers rely heavily on sitemaps for page discovery.",
        [],
        "A sitemap.xml file lists all the pages on your site in a machine-readable format. AI crawlers use sitemaps as their primary method of discovering pages — without one, they may miss large portions of your documentation. Create a sitemap.xml at your site root listing all documentation pages. Most static site generators and CMS platforms can generate one automatically. Include <lastmod> dates so crawlers know which content is fresh."
      )
    );
  } else {
    let sitemapIssues = 0;
    if (!aiFiles.sitemap.hasLastmod) {
      score -= 1;
      sitemapIssues++;
      findings.push(
        createFinding(
          "low",
          "Sitemap lacks <lastmod> dates. Adding these helps AI agents prioritize fresh content.",
          [],
          "The <lastmod> element in your sitemap tells crawlers when each page was last updated. AI agents use this to prioritize fresh content and skip pages that haven't changed. Without these dates, crawlers treat all pages equally and may waste time re-indexing unchanged content. Add <lastmod> dates in ISO 8601 format (e.g. 2024-01-15) to each <url> entry in your sitemap."
        )
      );
    }
    if (aiFiles.sitemap.coverageRatio < 0.5 && pages.length > 10) {
      score -= 1;
      sitemapIssues++;
      findings.push(
        createFinding(
          "med",
          `Sitemap only covers ${Math.round(aiFiles.sitemap.coverageRatio * 100)}% of crawled pages. Many pages may be undiscoverable.`,
          [],
          "Your sitemap lists significantly fewer pages than were found during crawling. This means many of your documentation pages are not included in the sitemap and may be missed by AI crawlers that rely on sitemaps for page discovery. Update your sitemap to include all public documentation pages. If some pages are intentionally excluded, ensure they're still reachable through internal links."
        )
      );
    }
    if (sitemapIssues === 0) {
      findings.push(
        createFinding(
          "pass",
          `sitemap.xml found with ${aiFiles.sitemap.urlCount} URLs and lastmod dates for freshness signals.`
        )
      );
    }
  }

  return {
    name: "AI Crawl Accessibility",
    score: Math.max(0, score),
    max: MAX_CATEGORY_SCORE,
    findings,
  };
}

function scoreStructuredDataAndMachineReadability(pages: ExtractedPage[]): CategoryResult {
  const findings: Finding[] = [];
  let score = MAX_CATEGORY_SCORE;

  const validPages = pages.filter((p) => !p.error);
  if (validPages.length === 0) {
    return { name: "Structured Data & Machine Readability", score: 0, max: MAX_CATEGORY_SCORE, findings: [] };
  }

  const pagesWithJsonLd = validPages.filter((p) => p.hasJsonLd);
  const jsonLdRatio = pagesWithJsonLd.length / validPages.length;

  const hasFAQContent = validPages.some((p) => p.faqItems.length > 0);
  
  if (jsonLdRatio < 0.1) {
    if (hasFAQContent) {
      score -= 3;
      findings.push(
        createFinding(
          "med",
          `FAQ content detected but no FAQPage JSON-LD schema. Adding this schema significantly improves AI citation likelihood.`,
          validPages.filter((p) => p.faqItems.length > 0).map((p) => p.url),
          "Your documentation contains FAQ-style content (question and answer patterns), but it's not marked up with FAQPage JSON-LD schema. AI systems like Google's Search Generative Experience heavily prioritize FAQ structured data when generating answers. Adding FAQPage schema wraps your Q&A content in a format AI can parse directly, making it much more likely to be cited. You can add this as a <script type=\"application/ld+json\"> block in the page head."
        )
      );
    } else {
      score -= 1;
      findings.push(
        createFinding(
          "low",
          `No JSON-LD structured data found. Optional for docs, but FAQPage/TechArticle schemas can improve AI visibility.`,
          [],
          "JSON-LD (JavaScript Object Notation for Linked Data) is a way to embed structured metadata in your pages using <script type=\"application/ld+json\"> tags. While not strictly required, adding schemas like TechArticle, HowTo, or FAQPage helps AI systems understand your content's type and structure. This metadata gives AI agents additional context beyond the raw text, improving how they categorize and cite your documentation."
        )
      );
    }
  } else if (jsonLdRatio < 0.5) {
    findings.push(
      createFinding(
        "low",
        `${Math.round(jsonLdRatio * 100)}% of pages have JSON-LD. Consider expanding coverage.`,
        validPages.filter((p) => !p.hasJsonLd).map((p) => p.url),
        "Some of your pages have JSON-LD structured data, but coverage is below 50%. The listed pages lack structured data. Expanding coverage ensures AI agents have consistent metadata across your documentation. Consider adding TechArticle or Article schemas to your remaining pages — many static site generators support this through templates, so you can add it once and apply it everywhere."
      )
    );
  } else {
    findings.push(
      createFinding(
        "pass",
        `${Math.round(jsonLdRatio * 100)}% of pages have JSON-LD structured data for AI context.`
      )
    );
  }

  const allJsonLdTypes = validPages.flatMap((p) => p.jsonLdTypes);
  const hasRichTypes = allJsonLdTypes.some((t) =>
    /TechArticle|HowTo|APIReference|SoftwareSourceCode|FAQPage/i.test(t)
  );

  if (!hasRichTypes && pagesWithJsonLd.length > 0) {
    score -= 2;
    findings.push(
      createFinding(
        "low",
        "JSON-LD exists but lacks documentation-specific types (TechArticle, HowTo, APIReference). Use richer schema types.",
        [],
        "Your pages have JSON-LD, but they use generic types like 'WebPage' or 'Article'. Documentation-specific schema types give AI agents much richer signals. TechArticle tells an AI that the page contains technical content; HowTo indicates step-by-step instructions; FAQPage marks question-answer content. Using these types helps AI systems categorize your content correctly and surface it for the right queries. Update your JSON-LD @type field to use the most specific type that matches your content."
      )
    );
  } else if (hasRichTypes) {
    findings.push(
      createFinding(
        "pass",
        "Rich schema types detected (TechArticle, HowTo, or similar) for enhanced AI understanding."
      )
    );
  }

  const pagesWithOpenAPI = validPages.filter((p) => p.hasOpenAPILink);
  if (pagesWithOpenAPI.length === 0) {
    const hasAPIContent = validPages.some(
      (p) => /api|endpoint|request|response/i.test(p.mainContent)
    );
    if (hasAPIContent) {
      score -= 5;
      findings.push(
        createFinding(
          "high",
          "API documentation detected but no OpenAPI/Swagger spec link found. Machine-readable API specs are critical for AI agents.",
          validPages.filter((p) => /api/i.test(p.url)).map((p) => p.url),
          "Your documentation includes API-related content (endpoints, requests, responses), but no link to an OpenAPI or Swagger specification was found. OpenAPI specs are the gold standard for machine-readable API documentation — AI agents can parse them to understand every endpoint, parameter, request body, and response format without scraping HTML. Host your OpenAPI spec as a JSON or YAML file and link to it from your API docs. Tools like Swagger UI, Redoc, or Stoplight can generate documentation from the spec automatically."
        )
      );
    }
  } else {
    findings.push(
      createFinding(
        "pass",
        `OpenAPI/Swagger spec found at: ${pagesWithOpenAPI[0].openAPIUrl || "linked pages"}`,
        pagesWithOpenAPI.map((p) => p.url)
      )
    );
  }

  return {
    name: "Structured Data & Machine Readability",
    score: Math.max(0, score),
    max: MAX_CATEGORY_SCORE,
    findings,
  };
}

function scoreContentSelfContainment(
  pages: ExtractedPage[],
  chunks: ContentChunk[],
  jsRendered: boolean
): CategoryResult {
  const findings: Finding[] = [];
  let score = MAX_CATEGORY_SCORE;

  const validPages = pages.filter((p) => !p.error);
  if (validPages.length === 0) {
    return { name: "Content Self-Containment", score: 0, max: MAX_CATEGORY_SCORE, findings: [] };
  }

  if (jsRendered) {
    score -= 10;
    findings.push(
      createFinding(
        "high",
        "Site is JavaScript-rendered. AI crawlers (GPTBot, Claude-Web, etc.) cannot index JS-rendered content. Most page content is invisible to AI agents. Consider server-side rendering (SSR) or static site generation (SSG).",
        [],
        "Your documentation site relies on client-side JavaScript to render content. When an AI crawler requests your pages, it receives a mostly empty HTML shell because it doesn't execute JavaScript. This means the actual documentation text, code examples, and navigation are invisible to AI agents. This is the single most impactful issue for AI discoverability. To fix this, switch to server-side rendering (SSR) using frameworks like Next.js or Nuxt, or use static site generation (SSG) with tools like Docusaurus, MkDocs, or Hugo. These approaches serve fully-rendered HTML that any crawler can read."
      )
    );
  } else {
    const thinPages = validPages.filter(
      (p) => p.mainContent.length > 0 && p.mainContent.length < 300
    );
    if (thinPages.length > validPages.length * 0.2) {
      const ratio = thinPages.length / validPages.length;
      const deduction = Math.min(5, Math.ceil(ratio * 10));
      score -= deduction;
      findings.push(
        createFinding(
          "high",
          `${thinPages.length} pages have thin content (<300 chars). AI agents need substantial, self-contained information.`,
          thinPages.map((p) => p.url),
          "These pages have very little text content (under 300 characters). When an AI retrieval system indexes a thin page, it produces a chunk that lacks enough context to generate a useful answer. Pages that serve as mere redirects, contain only a title, or rely heavily on images/videos without text descriptions are common culprits. Consider expanding these pages with descriptive text, or consolidating thin pages into more substantial parent pages. Every page should be able to stand on its own as a useful answer."
        )
      );
    } else {
      findings.push(
        createFinding(
          "pass",
          `${validPages.length - thinPages.length}/${validPages.length} pages have substantial content (>300 chars).`
        )
      );
    }
  }

  const shortChunks = chunks.filter((c) => c.tokenEstimate < 50);
  const longChunks = chunks.filter((c) => c.tokenEstimate > 800);
  const goodChunks = chunks.filter((c) => c.tokenEstimate >= 50 && c.tokenEstimate <= 800);

  if (shortChunks.length > chunks.length * 0.3) {
    const deduction = Math.min(3, Math.ceil((shortChunks.length / chunks.length) * 6));
    score -= deduction;
    findings.push(
      createFinding(
        "med",
        `${shortChunks.length} chunks are too short (<50 tokens). Content may lack context when retrieved.`,
        Array.from(new Set(shortChunks.map((c) => c.pageUrl))),
        "When AI retrieval systems index your documentation, they split pages into 'chunks' — sections of text typically divided by headings. A chunk under 50 tokens (roughly 1-2 short sentences) doesn't carry enough context for an AI to generate a useful answer from it alone. Short chunks often result from pages with many small headings, sparse content under each section, or navigation-heavy pages. The listed URLs contributed the most short chunks. To improve this, consolidate small sections under fewer headings, or add more descriptive text to brief sections."
      )
    );
  }

  if (longChunks.length > chunks.length * 0.2) {
    score -= 2;
    findings.push(
      createFinding(
        "low",
        `${longChunks.length} chunks exceed 800 tokens. Consider better heading structure for improved chunking.`,
        Array.from(new Set(longChunks.map((c) => c.pageUrl))),
        "Chunks over 800 tokens (roughly a full page of text) are too long for most AI retrieval systems to handle efficiently. When a chunk is too large, the AI may struggle to identify the relevant portion, or the chunk may get truncated. Long chunks usually result from pages with very few headings — large walls of text with no structural breaks. Adding more H2/H3 headings to break up long sections creates natural chunk boundaries, making each piece of content more focused and retrievable."
      )
    );
  }

  if (shortChunks.length <= chunks.length * 0.3 && longChunks.length <= chunks.length * 0.2 && chunks.length > 0) {
    findings.push(
      createFinding(
        "pass",
        `${goodChunks.length}/${chunks.length} chunks are well-sized (50-800 tokens) for AI retrieval.`
      )
    );
  }

  return {
    name: "Content Self-Containment",
    score: Math.max(0, score),
    max: MAX_CATEGORY_SCORE,
    findings,
  };
}



function scoreDocumentationArchitecture(pages: ExtractedPage[]): CategoryResult {
  const findings: Finding[] = [];
  let score = MAX_CATEGORY_SCORE;

  const validPages = pages.filter((p) => !p.error);
  if (validPages.length === 0) {
    return { name: "Documentation Architecture", score: 0, max: MAX_CATEGORY_SCORE, findings: [] };
  }

  const avgInternalLinks =
    validPages.reduce((sum, p) => sum + p.internalLinkCount, 0) / validPages.length;

  if (avgInternalLinks < 3) {
    score -= 5;
    findings.push(
      createFinding(
        "high",
        `Low internal linking: average ${avgInternalLinks.toFixed(1)} links per page. AI agents use link structure to understand relationships.`,
        validPages.filter((p) => p.internalLinkCount < 2).map((p) => p.url),
        "Internal links are how AI crawlers discover pages and understand how concepts relate to each other. With fewer than 3 links per page on average, your documentation appears disconnected — AI agents can't navigate between related topics, and pages without incoming links may never be discovered. Add 'See also' sections, link to related guides from within your content, and ensure every page links to at least 2-3 related pages. Good cross-linking also helps AI agents understand which pages are most important (more links = higher authority)."
      )
    );
  } else if (avgInternalLinks < 5) {
    score -= 2;
    findings.push(
      createFinding(
        "med",
        `Moderate internal linking: ${avgInternalLinks.toFixed(1)} links per page. Consider adding more cross-references.`,
        [],
        "Your documentation has some internal linking, but there's room for improvement. AI crawlers use link density and structure to understand page relationships and importance. Adding more contextual links — such as 'Related guides', 'Prerequisites', and inline references to other doc pages — helps AI agents build a richer understanding of your content graph. Aim for 5+ internal links per page through navigation, breadcrumbs, and in-content references."
      )
    );
  } else {
    findings.push(
      createFinding(
        "pass",
        `Good internal linking: average ${avgInternalLinks.toFixed(1)} links per page for AI navigation.`
      )
    );
  }

  const pagesWithBadH1 = validPages.filter((p) => {
    const h1Count = p.headings.filter((h) => h.level === 1).length;
    return h1Count !== 1;
  });

  if (pagesWithBadH1.length > validPages.length * 0.2) {
    const deduction = Math.min(4, Math.ceil((pagesWithBadH1.length / validPages.length) * 8));
    score -= deduction;
    findings.push(
      createFinding(
        "med",
        `${pagesWithBadH1.length} pages have missing or multiple H1 headings. Each page should have exactly one H1.`,
        pagesWithBadH1.map((p) => p.url),
        "Each documentation page should have exactly one H1 heading that clearly describes the page's topic. AI agents use the H1 as the primary identifier for what a page is about — it's the 'title' of the content chunk. Pages with no H1 leave AI agents guessing, and pages with multiple H1s create confusion about the page's primary topic. Check the listed pages and ensure each has a single, descriptive H1. If your framework generates duplicate H1s (e.g., from both a title field and the content), adjust your template."
      )
    );
  } else {
    findings.push(
      createFinding(
        "pass",
        `${validPages.length - pagesWithBadH1.length}/${validPages.length} pages have proper H1 heading structure.`
      )
    );
  }

  const pagesWithSkippedLevels = validPages.filter((p) => {
    const levels = p.headings.map((h) => h.level);
    for (let i = 1; i < levels.length; i++) {
      if (levels[i] - levels[i - 1] > 1) return true;
    }
    return false;
  });

  if (pagesWithSkippedLevels.length > validPages.length * 0.3) {
    score -= 2;
    findings.push(
      createFinding(
        "low",
        `${pagesWithSkippedLevels.length} pages skip heading levels (e.g., H2 to H4). Proper hierarchy aids content chunking.`,
        pagesWithSkippedLevels.map((p) => p.url),
        "Heading hierarchy (H1 > H2 > H3 > H4) is how AI chunking systems determine section boundaries and parent-child relationships between content. When you skip levels (e.g., jumping from H2 to H4), the chunker can't properly nest content, leading to chunks that lose their hierarchical context. For example, a subsection under 'Authentication > OAuth > Token Refresh' becomes just 'Token Refresh' with no parent context. Fix this by ensuring headings follow a sequential order without gaps."
      )
    );
  } else {
    findings.push(
      createFinding(
        "pass",
        `${validPages.length - pagesWithSkippedLevels.length}/${validPages.length} pages have proper heading hierarchy.`
      )
    );
  }

  const freshnessPatterns = [
    /last\s*updated/i,
    /modified/i,
    /dateModified/i,
    /datePublished/i,
    /<time/i,
  ];

  const pagesWithDates = validPages.filter((p) =>
    freshnessPatterns.some((pat) => pat.test(p.rawHtml))
  );

  if (pagesWithDates.length < validPages.length * 0.3) {
    score -= 3;
    findings.push(
      createFinding(
        "med",
        `Only ${pagesWithDates.length}/${validPages.length} pages show freshness signals. AI agents prioritize recently updated content.`,
        validPages.filter((p) => !freshnessPatterns.some((pat) => pat.test(p.rawHtml))).map((p) => p.url)
      )
    );
  } else {
    findings.push(
      createFinding(
        "pass",
        `${pagesWithDates.length}/${validPages.length} pages display freshness signals (dates, timestamps).`
      )
    );
  }

  const errorPages = pages.filter((p) => p.error || (p.statusCode >= 400 && p.statusCode < 600));
  if (errorPages.length > pages.length * 0.1) {
    score -= 2;
    findings.push(
      createFinding(
        "med",
        `${errorPages.length} pages returned errors. Broken links hurt crawl efficiency.`,
        errorPages.map((p) => p.url)
      )
    );
  } else {
    findings.push(
      createFinding(
        "pass",
        `Low error rate: ${errorPages.length}/${pages.length} pages with errors.`
      )
    );
  }

  return {
    name: "Documentation Architecture",
    score: Math.max(0, score),
    max: MAX_CATEGORY_SCORE,
    findings,
  };
}

export function scoreAll(
  pages: ExtractedPage[],
  chunks: ContentChunk[],
  aiFiles: AIDiscoveryFiles,
  jsRendered: boolean = false
): { categories: CategoryResult[]; overallScore: number; topFindings: Finding[] } {
  const categories: CategoryResult[] = [
    scoreAICrawlAccessibility(aiFiles, pages),
    scoreStructuredDataAndMachineReadability(pages),
    scoreContentSelfContainment(pages, chunks, jsRendered),
    scoreDocumentationArchitecture(pages),
  ];

  const totalScore = categories.reduce((sum, cat) => sum + cat.score, 0);
  const maxTotal = categories.reduce((sum, cat) => sum + cat.max, 0);
  const overallScore = Math.round((totalScore / maxTotal) * 100);

  const allFindings = categories.flatMap((cat) =>
    cat.findings.map((f) => ({
      ...f,
      category: cat.name,
    }))
  );

  const severityOrder: Record<FindingSeverity, number> = { high: 0, med: 1, low: 2, pass: 3 };
  const issueFindings = allFindings.filter(f => f.severity !== "pass");
  const sortedFindings = issueFindings.sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );

  const topFindings = sortedFindings.slice(0, 10);

  return { categories, overallScore, topFindings };
}
