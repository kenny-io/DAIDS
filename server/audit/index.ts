import type { AuditConfig, AuditResult } from "./types";
import { AuditConfigSchema } from "./types";
import { crawlSite } from "./crawler";
import { chunkAllPages } from "./chunker";
import { scoreAll } from "./scorer";
import { detectJSRendered } from "./extractor";
import { fetchAIDiscoveryFiles } from "./ai-discovery";

export async function runAudit(config: Partial<AuditConfig> & { url: string }): Promise<AuditResult> {
  const startTime = Date.now();

  const validatedConfig = AuditConfigSchema.parse(config);

  const crawlResult = await crawlSite(validatedConfig);
  const { pages, errorCount, skippedCount } = crawlResult;

  const validPages = pages.filter((p) => !p.error);

  const [chunks, aiFiles] = await Promise.all([
    Promise.resolve(chunkAllPages(validPages)),
    fetchAIDiscoveryFiles(validatedConfig, pages.length),
  ]);

  const jsRenderedWarning = detectJSRendered(pages);

  const { categories, overallScore, topFindings } = scoreAll(pages, chunks, aiFiles, jsRenderedWarning);

  const durationMs = Date.now() - startTime;

  return {
    rootUrl: validatedConfig.url,
    crawledPages: pages.length,
    score: overallScore,
    categories,
    topFindings,
    meta: {
      chunkCount: chunks.length,
      durationMs,
      errorCount,
      skippedPages: skippedCount,
      ...(jsRenderedWarning ? { jsRenderedWarning: true } : {}),
    },
  };
}

export { AuditConfigSchema } from "./types";
export type { AuditConfig, AuditResult } from "./types";
