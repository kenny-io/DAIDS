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
    if (!aiFiles.llmsTxt.hasProductDescription) {
      score -= 2;
      findings.push(
        createFinding(
          "med",
          "llms.txt exists but lacks a clear product description."
        )
      );
    }
    if (!aiFiles.llmsTxt.hasDocumentationLinks) {
      score -= 2;
      findings.push(
        createFinding(
          "med",
          "llms.txt should include links to key documentation sections."
        )
      );
    }
    if (!aiFiles.llmsTxt.hasUseCases) {
      score -= 1;
      findings.push(
        createFinding(
          "low",
          "llms.txt should describe common use cases for better AI recommendations."
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
    if (aiFiles.robotsTxt.blocksAICrawlers) {
      score -= 4;
      findings.push(
        createFinding(
          "high",
          "robots.txt blocks AI crawlers (GPTBot, Claude-Web, etc). Your content won't be indexed by AI agents."
        )
      );
    } else if (!aiFiles.robotsTxt.allowsAICrawlers && aiFiles.robotsTxt.aiCrawlerRules.length === 0) {
      score -= 1;
      findings.push(
        createFinding(
          "low",
          "robots.txt doesn't explicitly allow AI crawlers. Consider adding rules for GPTBot, Claude-Web, etc."
        )
      );
    }
    if (!aiFiles.robotsTxt.mentionsSitemap) {
      score -= 1;
      findings.push(
        createFinding(
          "low",
          "robots.txt should reference your sitemap.xml for better crawl discovery."
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
    if (!aiFiles.sitemap.hasLastmod) {
      score -= 1;
      findings.push(
        createFinding(
          "low",
          "Sitemap lacks <lastmod> dates. Adding these helps AI agents prioritize fresh content."
        )
      );
    }
    if (aiFiles.sitemap.coverageRatio < 0.5 && pages.length > 10) {
      score -= 1;
      findings.push(
        createFinding(
          "med",
          `Sitemap only covers ${Math.round(aiFiles.sitemap.coverageRatio * 100)}% of crawled pages. Many pages may be undiscoverable.`
        )
      );
    }
  }

  if (!aiFiles.aiLandingPage.exists) {
    score -= 2;
    findings.push(
      createFinding(
        "low",
        "No dedicated /ai or /llm landing page found. Consider creating a curated entry point for AI agents."
      )
    );
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

  if (jsonLdRatio < 0.1) {
    score -= 6;
    findings.push(
      createFinding(
        "high",
        `Only ${pagesWithJsonLd.length}/${validPages.length} pages have JSON-LD structured data. AI agents use this to understand page context.`,
        validPages.filter((p) => !p.hasJsonLd).map((p) => p.url)
      )
    );
  } else if (jsonLdRatio < 0.5) {
    const deduction = Math.ceil((0.5 - jsonLdRatio) * 8);
    score -= deduction;
    findings.push(
      createFinding(
        "med",
        `${Math.round(jsonLdRatio * 100)}% of pages have JSON-LD. Consider expanding coverage.`,
        validPages.filter((p) => !p.hasJsonLd).map((p) => p.url)
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
        "low",
        `OpenAPI/Swagger spec found at: ${pagesWithOpenAPI[0].openAPIUrl || "linked pages"}`,
        pagesWithOpenAPI.map((p) => p.url)
      )
    );
  }

  const pagesWithoutMeta = validPages.filter((p) => !p.metaDescription);
  if (pagesWithoutMeta.length > validPages.length * 0.3) {
    const ratio = pagesWithoutMeta.length / validPages.length;
    const deduction = Math.min(3, Math.ceil(ratio * 6));
    score -= deduction;
    findings.push(
      createFinding(
        "med",
        `${pagesWithoutMeta.length} pages lack meta descriptions. These help AI agents summarize content.`,
        pagesWithoutMeta.map((p) => p.url)
      )
    );
  }

  const pagesWithoutTitle = validPages.filter((p) => !p.title);
  if (pagesWithoutTitle.length > 0) {
    const deduction = Math.min(2, pagesWithoutTitle.length);
    score -= deduction;
    findings.push(
      createFinding(
        pagesWithoutTitle.length > 5 ? "high" : "med",
        `${pagesWithoutTitle.length} pages are missing title tags.`,
        pagesWithoutTitle.map((p) => p.url)
      )
    );
  }

  const avgScriptCount = validPages.reduce((sum, p) => sum + p.scriptCount, 0) / validPages.length;
  const avgTextToHtmlRatio = validPages.reduce((sum, p) => sum + p.textToHtmlRatio, 0) / validPages.length;

  if (avgScriptCount > 30) {
    score -= 2;
    findings.push(
      createFinding(
        "med",
        `High JavaScript dependency: average ${Math.round(avgScriptCount)} scripts per page. AI crawlers prefer clean, static HTML.`,
        validPages.filter((p) => p.scriptCount > 30).map((p) => p.url)
      )
    );
  }

  if (avgTextToHtmlRatio < 0.1) {
    score -= 2;
    findings.push(
      createFinding(
        "med",
        `Low text-to-HTML ratio (${(avgTextToHtmlRatio * 100).toFixed(1)}%). Pages may be overly complex or JS-rendered.`,
        validPages.filter((p) => p.textToHtmlRatio < 0.05).map((p) => p.url)
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
  chunks: ContentChunk[]
): CategoryResult {
  const findings: Finding[] = [];
  let score = MAX_CATEGORY_SCORE;

  const validPages = pages.filter((p) => !p.error);
  if (validPages.length === 0) {
    return { name: "Content Self-Containment", score: 0, max: MAX_CATEGORY_SCORE, findings: [] };
  }

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
  } else if (faqRatio > 0.1) {
    findings.push(
      createFinding(
        "low",
        `${pagesWithFAQ.length} pages have FAQ/Q&A content structure. This helps AI agents match user queries.`,
        pagesWithFAQ.map((p) => p.url)
      )
    );
  }

  const pagesWithPrereqs = validPages.filter((p) => p.hasPrerequisites);
  const prereqRatio = pagesWithPrereqs.length / validPages.length;

  if (prereqRatio < 0.1 && validPages.length > 10) {
    score -= 3;
    findings.push(
      createFinding(
        "med",
        "Few pages list prerequisites or requirements. Self-contained pages should explicitly state dependencies."
      )
    );
  }

  const shortChunks = chunks.filter((c) => c.tokenEstimate < 50);
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

  const longChunks = chunks.filter((c) => c.tokenEstimate > 800);
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

  return {
    name: "Content Self-Containment",
    score: Math.max(0, score),
    max: MAX_CATEGORY_SCORE,
    findings,
  };
}

function scoreCodeAndAPIUsability(pages: ExtractedPage[]): CategoryResult {
  const findings: Finding[] = [];
  let score = MAX_CATEGORY_SCORE;

  const validPages = pages.filter((p) => !p.error);
  if (validPages.length === 0) {
    return { name: "Code & API Usability", score: 0, max: MAX_CATEGORY_SCORE, findings: [] };
  }

  const pagesWithCode = validPages.filter((p) => p.codeBlocks.length > 0);
  const codeRatio = pagesWithCode.length / validPages.length;

  if (codeRatio < 0.3) {
    const deduction = Math.min(5, Math.ceil((0.3 - codeRatio) * 15));
    score -= deduction;
    findings.push(
      createFinding(
        codeRatio < 0.1 ? "high" : "med",
        `Only ${Math.round(codeRatio * 100)}% of pages have code examples. Developers rely on copy-paste ready snippets.`,
        validPages.filter((p) => p.codeBlocks.length === 0).map((p) => p.url)
      )
    );
  }

  const allCodeBlocks = validPages.flatMap((p) =>
    p.codeBlocks.map((c) => ({ ...c, pageUrl: p.url }))
  );
  const untaggedBlocks = allCodeBlocks.filter((c) => !c.language);

  if (untaggedBlocks.length > 0) {
    const untaggedRatio = untaggedBlocks.length / Math.max(1, allCodeBlocks.length);
    const deduction = Math.min(5, Math.ceil(untaggedRatio * 10));
    score -= deduction;
    findings.push(
      createFinding(
        untaggedRatio > 0.5 ? "high" : "med",
        `${untaggedBlocks.length}/${allCodeBlocks.length} code blocks lack language tags. AI agents need these for syntax understanding.`,
        Array.from(new Set(untaggedBlocks.map((c) => c.pageUrl)))
      )
    );
  }

  const allLanguages = Array.from(new Set(
    validPages.flatMap((p) => p.codeLanguages)
  ));
  const languageCount = allLanguages.length;

  if (languageCount === 0 && pagesWithCode.length > 0) {
    score -= 3;
    findings.push(
      createFinding(
        "med",
        "No programming languages detected in code blocks. Use language-tagged code fences."
      )
    );
  } else if (languageCount === 1) {
    findings.push(
      createFinding(
        "low",
        `Code examples only in one language (${allLanguages[0]}). Consider adding examples in multiple languages.`
      )
    );
  } else if (languageCount >= 3) {
    findings.push(
      createFinding(
        "low",
        `Good language diversity: ${languageCount} languages detected (${allLanguages.slice(0, 5).join(", ")}).`
      )
    );
  }

  if (pagesWithCode.length > 0) {
    const avgCodeBlocks =
      pagesWithCode.reduce((sum, p) => sum + p.codeBlocks.length, 0) / pagesWithCode.length;
    if (avgCodeBlocks < 1.5) {
      score -= 2;
      findings.push(
        createFinding(
          "low",
          `Low code density: ${avgCodeBlocks.toFixed(1)} code blocks per page. More examples improve usability.`
        )
      );
    }
  }

  return {
    name: "Code & API Usability",
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
  }

  const changelogPatterns = [/changelog/i, /release.?notes/i, /what's.?new/i];
  const hasChangelog = validPages.some((p) =>
    changelogPatterns.some((pat) => pat.test(p.url) || (p.title && pat.test(p.title)))
  );

  if (!hasChangelog) {
    score -= 2;
    findings.push(
      createFinding(
        "low",
        "No changelog or release notes page detected. Versioning information builds trust with AI agents."
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
  aiFiles: AIDiscoveryFiles
): { categories: CategoryResult[]; overallScore: number; topFindings: Finding[] } {
  const categories: CategoryResult[] = [
    scoreAICrawlAccessibility(aiFiles, pages),
    scoreStructuredDataAndMachineReadability(pages),
    scoreContentSelfContainment(pages, chunks),
    scoreCodeAndAPIUsability(pages),
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

  const severityOrder: Record<FindingSeverity, number> = { high: 0, med: 1, low: 2 };
  const sortedFindings = allFindings.sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );

  const topFindings = sortedFindings.slice(0, 10);

  return { categories, overallScore, topFindings };
}
