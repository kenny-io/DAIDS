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
  urls: string[] = []
): Finding {
  return {
    severity,
    message,
    urls: urls.slice(0, TOP_URLS_LIMIT),
  };
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
        "No llms.txt file found. This file helps AI agents understand your site structure and content."
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
          "llms.txt exists but lacks a clear product description."
        )
      );
    }
    if (!aiFiles.llmsTxt.hasDocumentationLinks) {
      score -= 2;
      llmsTxtIssues++;
      findings.push(
        createFinding(
          "med",
          "llms.txt should include links to key documentation sections."
        )
      );
    }
    if (!aiFiles.llmsTxt.hasUseCases) {
      score -= 1;
      llmsTxtIssues++;
      findings.push(
        createFinding(
          "low",
          "llms.txt should describe common use cases for better AI recommendations."
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
        "No robots.txt file found. AI crawlers need clear access rules."
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
          "robots.txt blocks AI crawlers (GPTBot, Claude-Web, etc). Your content won't be indexed by AI agents."
        )
      );
    } else if (!aiFiles.robotsTxt.allowsAICrawlers && aiFiles.robotsTxt.aiCrawlerRules.length === 0) {
      score -= 1;
      robotsTxtIssues++;
      findings.push(
        createFinding(
          "low",
          "robots.txt doesn't explicitly allow AI crawlers. Consider adding rules for GPTBot, Claude-Web, etc."
        )
      );
    }
    if (!aiFiles.robotsTxt.mentionsSitemap) {
      score -= 1;
      robotsTxtIssues++;
      findings.push(
        createFinding(
          "low",
          "robots.txt should reference your sitemap.xml for better crawl discovery."
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
        "No sitemap.xml found. AI crawlers rely heavily on sitemaps for page discovery."
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
          "Sitemap lacks <lastmod> dates. Adding these helps AI agents prioritize fresh content."
        )
      );
    }
    if (aiFiles.sitemap.coverageRatio < 0.5 && pages.length > 10) {
      score -= 1;
      sitemapIssues++;
      findings.push(
        createFinding(
          "med",
          `Sitemap only covers ${Math.round(aiFiles.sitemap.coverageRatio * 100)}% of crawled pages. Many pages may be undiscoverable.`
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
          validPages.filter((p) => p.faqItems.length > 0).map((p) => p.url)
        )
      );
    } else {
      score -= 1;
      findings.push(
        createFinding(
          "low",
          `No JSON-LD structured data found. Optional for docs, but FAQPage/TechArticle schemas can improve AI visibility.`
        )
      );
    }
  } else if (jsonLdRatio < 0.5) {
    findings.push(
      createFinding(
        "low",
        `${Math.round(jsonLdRatio * 100)}% of pages have JSON-LD. Consider expanding coverage.`,
        validPages.filter((p) => !p.hasJsonLd).map((p) => p.url)
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
        "JSON-LD exists but lacks documentation-specific types (TechArticle, HowTo, APIReference). Use richer schema types."
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
          validPages.filter((p) => /api/i.test(p.url)).map((p) => p.url)
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
        "Site is JavaScript-rendered. AI crawlers (GPTBot, Claude-Web, etc.) cannot index JS-rendered content. Most page content is invisible to AI agents. Consider server-side rendering (SSR) or static site generation (SSG)."
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
          thinPages.map((p) => p.url)
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

  const pagesWithFAQ = validPages.filter(
    (p) => p.hasFAQSchema || p.faqItems.length > 0
  );
  const faqRatio = pagesWithFAQ.length / validPages.length;

  if (faqRatio < 0.05) {
    score -= 4;
    findings.push(
      createFinding(
        "med",
        "Few pages use FAQ format. AI agents perform better with Q&A-structured content that matches natural queries."
      )
    );
  } else {
    findings.push(
      createFinding(
        "pass",
        `${pagesWithFAQ.length} pages have FAQ/Q&A content structure for better query matching.`,
        pagesWithFAQ.map((p) => p.url)
      )
    );
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
        Array.from(new Set(shortChunks.map((c) => c.pageUrl)))
      )
    );
  }

  if (longChunks.length > chunks.length * 0.2) {
    score -= 2;
    findings.push(
      createFinding(
        "low",
        `${longChunks.length} chunks exceed 800 tokens. Consider better heading structure for improved chunking.`,
        Array.from(new Set(longChunks.map((c) => c.pageUrl)))
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
        validPages.filter((p) => p.internalLinkCount < 2).map((p) => p.url)
      )
    );
  } else if (avgInternalLinks < 5) {
    score -= 2;
    findings.push(
      createFinding(
        "med",
        `Moderate internal linking: ${avgInternalLinks.toFixed(1)} links per page. Consider adding more cross-references.`
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
        pagesWithBadH1.map((p) => p.url)
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
        pagesWithSkippedLevels.map((p) => p.url)
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
