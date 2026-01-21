import pLimit from "p-limit";
import type { AuditConfig, ExtractedPage, CrawlResult } from "./types";
import { isSSRFSafe, normalizeUrl, isSameOrigin, getPathDepth, getSitemapUrls } from "./url-utils";
import { extractPageData } from "./extractor";
import * as cheerio from "cheerio";

const MAX_REDIRECTS = 5;

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  userAgent: string
): Promise<{ html: string; statusCode: number } | { error: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let currentUrl = url;
    let redirectCount = 0;

    while (redirectCount < MAX_REDIRECTS) {
      const ssrfCheck = await isSSRFSafe(currentUrl);
      if (!ssrfCheck.safe) {
        clearTimeout(timeoutId);
        return { error: `SSRF protection: ${ssrfCheck.reason}` };
      }

      const response = await fetch(currentUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent": userAgent,
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "manual",
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          clearTimeout(timeoutId);
          return { error: "Redirect without location header" };
        }

        currentUrl = new URL(location, currentUrl).toString();
        redirectCount++;
        continue;
      }

      clearTimeout(timeoutId);

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
        return { error: `Non-HTML content type: ${contentType}` };
      }

      const html = await response.text();
      return { html, statusCode: response.status };
    }

    clearTimeout(timeoutId);
    return { error: "Too many redirects" };
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === "AbortError") {
      return { error: "Request timeout" };
    }
    return { error: e.message || "Unknown fetch error" };
  }
}

async function fetchSitemap(
  sitemapUrl: string,
  timeoutMs: number,
  userAgent: string
): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(sitemapUrl, {
      signal: controller.signal,
      headers: { "User-Agent": userAgent },
    });

    clearTimeout(timeoutId);

    if (!response.ok) return [];

    const text = await response.text();
    const urls: string[] = [];

    const locMatches = Array.from(text.matchAll(/<loc>([^<]+)<\/loc>/gi));
    for (const match of locMatches) {
      const url = match[1].trim();
      if (url.endsWith(".xml")) {
        const nestedUrls = await fetchSitemap(url, timeoutMs, userAgent);
        urls.push(...nestedUrls);
      } else {
        urls.push(url);
      }
    }

    return urls;
  } catch {
    return [];
  }
}

export async function crawlSite(config: AuditConfig): Promise<CrawlResult> {
  const ssrfCheck = await isSSRFSafe(config.url);
  if (!ssrfCheck.safe) {
    throw new Error(`SSRF protection: ${ssrfCheck.reason}`);
  }

  const rootUrl = normalizeUrl(config.url);
  if (!rootUrl) {
    throw new Error("Invalid root URL");
  }

  const limit = pLimit(config.concurrency);
  const visited = new Set<string>();
  const toVisit: Array<{ url: string; depth: number }> = [];
  const pages: ExtractedPage[] = [];
  let errorCount = 0;
  let skippedCount = 0;

  const sitemapUrls = getSitemapUrls(rootUrl);
  for (const sitemapUrl of sitemapUrls) {
    const urls = await fetchSitemap(sitemapUrl, config.timeoutMs, config.userAgent);
    for (const url of urls) {
      const normalized = normalizeUrl(url);
      if (normalized && isSameOrigin(normalized, rootUrl) && !visited.has(normalized)) {
        visited.add(normalized);
        toVisit.push({ url: normalized, depth: getPathDepth(normalized, rootUrl) });
      }
    }
    if (toVisit.length > 0) break;
  }

  const rootNormalized = normalizeUrl(rootUrl);
  if (rootNormalized && !visited.has(rootNormalized)) {
    visited.add(rootNormalized);
    toVisit.unshift({ url: rootNormalized, depth: 0 });
  }

  const processUrl = async (item: { url: string; depth: number }): Promise<void> => {
    if (pages.length >= config.maxPages) return;

    const ssrf = await isSSRFSafe(item.url);
    if (!ssrf.safe) {
      skippedCount++;
      return;
    }

    const result = await fetchWithTimeout(item.url, config.timeoutMs, config.userAgent);

    if ("error" in result) {
      errorCount++;
      pages.push({
        url: item.url,
        title: null,
        canonical: null,
        metaDescription: null,
        headings: [],
        codeBlocks: [],
        internalLinks: [],
        mainContent: "",
        rawHtml: "",
        statusCode: 0,
        error: result.error,
      });
      return;
    }

    const pageData = extractPageData(result.html, item.url, result.statusCode);
    pages.push(pageData);

    if (item.depth < config.maxDepth) {
      for (const link of pageData.internalLinks) {
        const normalized = normalizeUrl(link, item.url);
        if (
          normalized &&
          isSameOrigin(normalized, rootUrl) &&
          !visited.has(normalized) &&
          toVisit.length + pages.length < config.maxPages * 2
        ) {
          visited.add(normalized);
          toVisit.push({ url: normalized, depth: item.depth + 1 });
        }
      }
    }
  };

  while (toVisit.length > 0 && pages.length < config.maxPages) {
    const batch = toVisit.splice(0, config.concurrency);
    await Promise.all(batch.map((item) => limit(() => processUrl(item))));
  }

  return {
    pages,
    errorCount,
    skippedCount,
  };
}
