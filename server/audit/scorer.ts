import type {
  ExtractedPage,
  ContentChunk,
  CategoryResult,
  Finding,
  FindingSeverity,
} from "./types";

const MAX_CATEGORY_SCORE = 20;
const TOP_URLS_LIMIT = 10;

function createFinding(
  severity: FindingSeverity,
  message: string,
  urls: string[]
): Finding {
  return {
    severity,
    message,
    urls: urls.slice(0, TOP_URLS_LIMIT),
  };
}

function scoreAgentDiscoveryReadiness(pages: ExtractedPage[]): CategoryResult {
  const findings: Finding[] = [];
  let score = MAX_CATEGORY_SCORE;

  const pagesWithoutTitle = pages.filter((p) => !p.title && !p.error);
  if (pagesWithoutTitle.length > 0) {
    const ratio = pagesWithoutTitle.length / pages.length;
    const deduction = Math.min(5, Math.ceil(ratio * 10));
    score -= deduction;
    findings.push(
      createFinding(
        ratio > 0.2 ? "high" : "med",
        `${pagesWithoutTitle.length} pages are missing a title tag.`,
        pagesWithoutTitle.map((p) => p.url)
      )
    );
  }

  const pagesWithoutMeta = pages.filter((p) => !p.metaDescription && !p.error);
  if (pagesWithoutMeta.length > 0) {
    const ratio = pagesWithoutMeta.length / pages.length;
    const deduction = Math.min(4, Math.ceil(ratio * 8));
    score -= deduction;
    findings.push(
      createFinding(
        ratio > 0.3 ? "high" : "med",
        `${pagesWithoutMeta.length} pages are missing a meta description.`,
        pagesWithoutMeta.map((p) => p.url)
      )
    );
  }

  const pagesWithoutCanonical = pages.filter((p) => !p.canonical && !p.error);
  if (pagesWithoutCanonical.length > 0) {
    const ratio = pagesWithoutCanonical.length / pages.length;
    const deduction = Math.min(3, Math.ceil(ratio * 6));
    score -= deduction;
    findings.push(
      createFinding(
        ratio > 0.5 ? "med" : "low",
        `${pagesWithoutCanonical.length} pages are missing a canonical URL.`,
        pagesWithoutCanonical.map((p) => p.url)
      )
    );
  }

  const urlsByNormalized = new Map<string, string[]>();
  for (const page of pages) {
    if (page.error) continue;
    const normalized = page.url.replace(/\/$/, "").replace(/\?.*$/, "");
    const existing = urlsByNormalized.get(normalized) || [];
    existing.push(page.url);
    urlsByNormalized.set(normalized, existing);
  }

  const duplicateGroups = Array.from(urlsByNormalized.values()).filter((g) => g.length > 1);
  if (duplicateGroups.length > 0) {
    const deduction = Math.min(3, duplicateGroups.length);
    score -= deduction;
    findings.push(
      createFinding(
        "med",
        `${duplicateGroups.length} potential duplicate URL patterns detected.`,
        duplicateGroups.flat().slice(0, TOP_URLS_LIMIT)
      )
    );
  }

  const errorPages = pages.filter((p) => p.error || (p.statusCode >= 400 && p.statusCode < 600));
  if (errorPages.length > 0) {
    const ratio = errorPages.length / pages.length;
    const deduction = Math.min(4, Math.ceil(ratio * 8));
    score -= deduction;
    findings.push(
      createFinding(
        ratio > 0.1 ? "high" : "med",
        `${errorPages.length} pages returned errors or were inaccessible.`,
        errorPages.map((p) => p.url)
      )
    );
  }

  return {
    name: "Agent discovery readiness",
    score: Math.max(0, score),
    max: MAX_CATEGORY_SCORE,
    findings,
  };
}

function scoreStructureAndChunkability(pages: ExtractedPage[]): CategoryResult {
  const findings: Finding[] = [];
  let score = MAX_CATEGORY_SCORE;

  const validPages = pages.filter((p) => !p.error);

  const pagesWithoutH1 = validPages.filter((p) => !p.headings.some((h) => h.level === 1));
  const pagesWithMultipleH1 = validPages.filter(
    (p) => p.headings.filter((h) => h.level === 1).length > 1
  );

  if (pagesWithoutH1.length > 0 || pagesWithMultipleH1.length > 0) {
    const badH1Count = pagesWithoutH1.length + pagesWithMultipleH1.length;
    const ratio = badH1Count / validPages.length;
    const deduction = Math.min(5, Math.ceil(ratio * 10));
    score -= deduction;

    if (pagesWithoutH1.length > 0) {
      findings.push(
        createFinding(
          "high",
          `${pagesWithoutH1.length} pages are missing an H1 heading.`,
          pagesWithoutH1.map((p) => p.url)
        )
      );
    }
    if (pagesWithMultipleH1.length > 0) {
      findings.push(
        createFinding(
          "med",
          `${pagesWithMultipleH1.length} pages have multiple H1 headings.`,
          pagesWithMultipleH1.map((p) => p.url)
        )
      );
    }
  }

  const pagesWithFewHeadings = validPages.filter((p) => p.headings.length < 3 && p.mainContent.length > 1000);
  if (pagesWithFewHeadings.length > 0) {
    const ratio = pagesWithFewHeadings.length / validPages.length;
    const deduction = Math.min(4, Math.ceil(ratio * 8));
    score -= deduction;
    findings.push(
      createFinding(
        "med",
        `${pagesWithFewHeadings.length} long pages have insufficient heading structure.`,
        pagesWithFewHeadings.map((p) => p.url)
      )
    );
  }

  const veryLargePages = validPages.filter((p) => p.mainContent.length > 20000);
  if (veryLargePages.length > 0) {
    const ratio = veryLargePages.length / validPages.length;
    const deduction = Math.min(4, Math.ceil(ratio * 8));
    score -= deduction;
    findings.push(
      createFinding(
        "med",
        `${veryLargePages.length} pages are extremely large and may chunk poorly.`,
        veryLargePages.map((p) => p.url)
      )
    );
  }

  const inconsistentHeadingPages = validPages.filter((p) => {
    const levels = p.headings.map((h) => h.level);
    for (let i = 1; i < levels.length; i++) {
      if (levels[i] - levels[i - 1] > 1) return true;
    }
    return false;
  });

  if (inconsistentHeadingPages.length > 0) {
    const ratio = inconsistentHeadingPages.length / validPages.length;
    const deduction = Math.min(3, Math.ceil(ratio * 6));
    score -= deduction;
    findings.push(
      createFinding(
        "low",
        `${inconsistentHeadingPages.length} pages have inconsistent heading hierarchy (skipped levels).`,
        inconsistentHeadingPages.map((p) => p.url)
      )
    );
  }

  return {
    name: "Structure and chunkability",
    score: Math.max(0, score),
    max: MAX_CATEGORY_SCORE,
    findings,
  };
}

function scoreRetrievalSelfContainment(
  pages: ExtractedPage[],
  chunks: ContentChunk[]
): CategoryResult {
  const findings: Finding[] = [];
  let score = MAX_CATEGORY_SCORE;

  const validPages = pages.filter((p) => !p.error);

  const thinPages = validPages.filter((p) => p.mainContent.length < 200 && p.mainContent.length > 0);
  if (thinPages.length > 0) {
    const ratio = thinPages.length / validPages.length;
    const deduction = Math.min(5, Math.ceil(ratio * 10));
    score -= deduction;
    findings.push(
      createFinding(
        ratio > 0.2 ? "high" : "med",
        `${thinPages.length} pages have very little content (thin pages).`,
        thinPages.map((p) => p.url)
      )
    );
  }

  const shortChunks = chunks.filter((c) => c.tokenEstimate < 50);
  const longChunks = chunks.filter((c) => c.tokenEstimate > 800);

  if (shortChunks.length > 0) {
    const ratio = shortChunks.length / Math.max(1, chunks.length);
    const deduction = Math.min(4, Math.ceil(ratio * 8));
    score -= deduction;
    findings.push(
      createFinding(
        ratio > 0.3 ? "med" : "low",
        `${shortChunks.length} chunks are very short and may lack context.`,
        Array.from(new Set(shortChunks.map((c) => c.pageUrl))).slice(0, TOP_URLS_LIMIT)
      )
    );
  }

  if (longChunks.length > 0) {
    const ratio = longChunks.length / Math.max(1, chunks.length);
    const deduction = Math.min(4, Math.ceil(ratio * 8));
    score -= deduction;
    findings.push(
      createFinding(
        ratio > 0.2 ? "med" : "low",
        `${longChunks.length} chunks are very long and may exceed context limits.`,
        Array.from(new Set(longChunks.map((c) => c.pageUrl))).slice(0, TOP_URLS_LIMIT)
      )
    );
  }

  const vagueReferencePattern = /\b(this|that|it|here|there|these|those)\b/gi;
  const chunksWithVagueRefs = chunks.filter((c) => {
    const matches = c.content.match(vagueReferencePattern) || [];
    const ratio = matches.length / (c.content.split(/\s+/).length || 1);
    return ratio > 0.05 && c.tokenEstimate < 200;
  });

  if (chunksWithVagueRefs.length > 0) {
    const ratio = chunksWithVagueRefs.length / Math.max(1, chunks.length);
    const deduction = Math.min(3, Math.ceil(ratio * 6));
    score -= deduction;
    findings.push(
      createFinding(
        "low",
        `${chunksWithVagueRefs.length} small chunks have high vague reference density.`,
        Array.from(new Set(chunksWithVagueRefs.map((c) => c.pageUrl))).slice(0, TOP_URLS_LIMIT)
      )
    );
  }

  return {
    name: "Retrieval self-containment",
    score: Math.max(0, score),
    max: MAX_CATEGORY_SCORE,
    findings,
  };
}

function scoreAgentUsability(pages: ExtractedPage[]): CategoryResult {
  const findings: Finding[] = [];
  let score = MAX_CATEGORY_SCORE;

  const validPages = pages.filter((p) => !p.error);

  const pagesWithCode = validPages.filter((p) => p.codeBlocks.length > 0);
  const pagesWithoutCode = validPages.filter((p) => p.codeBlocks.length === 0);

  if (pagesWithoutCode.length > validPages.length * 0.5) {
    const ratio = pagesWithoutCode.length / validPages.length;
    const deduction = Math.min(4, Math.ceil((ratio - 0.5) * 8));
    score -= deduction;
    findings.push(
      createFinding(
        "med",
        `${pagesWithoutCode.length} pages have no code examples.`,
        pagesWithoutCode.map((p) => p.url)
      )
    );
  }

  const allCodeBlocks = validPages.flatMap((p) =>
    p.codeBlocks.map((c) => ({ ...c, pageUrl: p.url }))
  );
  const untaggedCodeBlocks = allCodeBlocks.filter((c) => !c.language);

  if (untaggedCodeBlocks.length > 0) {
    const ratio = untaggedCodeBlocks.length / Math.max(1, allCodeBlocks.length);
    const deduction = Math.min(5, Math.ceil(ratio * 10));
    score -= deduction;
    findings.push(
      createFinding(
        ratio > 0.5 ? "high" : "med",
        `${untaggedCodeBlocks.length} code blocks are missing language tags.`,
        Array.from(new Set(untaggedCodeBlocks.map((c) => c.pageUrl))).slice(0, TOP_URLS_LIMIT)
      )
    );
  }

  if (pagesWithCode.length > 0) {
    const avgCodeBlocks =
      pagesWithCode.reduce((sum, p) => sum + p.codeBlocks.length, 0) / pagesWithCode.length;
    if (avgCodeBlocks < 1.5) {
      const deduction = Math.min(3, Math.ceil((1.5 - avgCodeBlocks) * 4));
      score -= deduction;
      findings.push(
        createFinding(
          "low",
          `Low code example density: average ${avgCodeBlocks.toFixed(1)} code blocks per page.`,
          pagesWithCode.slice(0, TOP_URLS_LIMIT).map((p) => p.url)
        )
      );
    }
  }

  return {
    name: "Agent usability for developers",
    score: Math.max(0, score),
    max: MAX_CATEGORY_SCORE,
    findings,
  };
}

function scoreTrustAndFreshness(pages: ExtractedPage[]): CategoryResult {
  const findings: Finding[] = [];
  let score = MAX_CATEGORY_SCORE;

  const validPages = pages.filter((p) => !p.error);

  const lastUpdatedPatterns = [
    /last\s*updated/i,
    /modified/i,
    /updated\s*on/i,
    /published/i,
    /<time/i,
    /dateModified/i,
    /datePublished/i,
    /article:modified_time/i,
    /article:published_time/i,
  ];

  const pagesWithDateSignals = validPages.filter((p) =>
    lastUpdatedPatterns.some(
      (pattern) => pattern.test(p.rawHtml) || pattern.test(p.mainContent)
    )
  );

  if (pagesWithDateSignals.length < validPages.length * 0.3) {
    const ratio = pagesWithDateSignals.length / validPages.length;
    const deduction = Math.min(5, Math.ceil((0.3 - ratio) * 15));
    score -= deduction;
    findings.push(
      createFinding(
        "med",
        `Only ${pagesWithDateSignals.length}/${validPages.length} pages have last-updated signals.`,
        validPages
          .filter((p) => !pagesWithDateSignals.includes(p))
          .slice(0, TOP_URLS_LIMIT)
          .map((p) => p.url)
      )
    );
  }

  const changelogPatterns = [/changelog/i, /release\s*notes/i, /what's\s*new/i, /updates/i];
  const hasChangelogPage = validPages.some((p) =>
    changelogPatterns.some((pattern) => pattern.test(p.url) || (p.title && pattern.test(p.title)))
  );

  if (!hasChangelogPage) {
    score -= 3;
    findings.push(
      createFinding("low", "No changelog or release notes page detected.", [])
    );
  }

  const structuredDataPatterns = [
    /"@type"/,
    /application\/ld\+json/,
    /itemtype="http:\/\/schema\.org/,
  ];

  const pagesWithStructuredData = validPages.filter((p) =>
    structuredDataPatterns.some((pattern) => pattern.test(p.rawHtml))
  );

  if (pagesWithStructuredData.length < validPages.length * 0.1) {
    score -= 2;
    findings.push(
      createFinding(
        "low",
        `Only ${pagesWithStructuredData.length}/${validPages.length} pages have structured data.`,
        []
      )
    );
  }

  return {
    name: "Trust and freshness signals",
    score: Math.max(0, score),
    max: MAX_CATEGORY_SCORE,
    findings,
  };
}

export function scoreAll(
  pages: ExtractedPage[],
  chunks: ContentChunk[]
): { categories: CategoryResult[]; overallScore: number; topFindings: Finding[] } {
  const categories: CategoryResult[] = [
    scoreAgentDiscoveryReadiness(pages),
    scoreStructureAndChunkability(pages),
    scoreRetrievalSelfContainment(pages, chunks),
    scoreAgentUsability(pages),
    scoreTrustAndFreshness(pages),
  ];

  const totalScore = categories.reduce((sum, cat) => sum + cat.score, 0);
  const maxTotal = categories.reduce((sum, cat) => sum + cat.max, 0);
  const overallScore = Math.round((totalScore / maxTotal) * 100);

  const allFindings = categories.flatMap((cat) =>
    cat.findings.map((f) => ({
      ...f,
      message: `${cat.name}: ${f.message}`,
    }))
  );

  const severityOrder: Record<FindingSeverity, number> = { high: 0, med: 1, low: 2 };
  const sortedFindings = allFindings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const topFindings = sortedFindings.slice(0, 10);

  return { categories, overallScore, topFindings };
}
