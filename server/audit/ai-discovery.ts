import type { AIDiscoveryFiles, AuditConfig } from "./types";
import { isSSRFSafe } from "./url-utils";

const AI_CRAWLER_USER_AGENTS = [
  "GPTBot",
  "ChatGPT-User",
  "Claude-Web",
  "anthropic-ai",
  "Google-Extended",
  "CCBot",
  "Amazonbot",
  "Applebot-Extended",
  "PerplexityBot",
  "Bytespider",
];

async function fetchTextFile(
  url: string,
  timeoutMs: number,
  userAgent: string
): Promise<string | null> {
  try {
    const ssrfCheck = await isSSRFSafe(url);
    if (!ssrfCheck.safe) return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": userAgent },
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

function parseLlmsTxt(content: string | null): AIDiscoveryFiles["llmsTxt"] {
  if (!content) {
    return {
      exists: false,
      content: null,
      hasProductDescription: false,
      hasDocumentationLinks: false,
      hasUseCases: false,
    };
  }

  const hasProductDescription =
    content.includes(">") || /^#\s+.+/m.test(content);
  const hasDocumentationLinks =
    /documentation|docs|getting.?started|api.?reference|tutorial/i.test(content) &&
    /https?:\/\/|^\s*-\s*\//m.test(content);
  const hasUseCases =
    /use.?case|solution|example|when.?to.?use/i.test(content);

  return {
    exists: true,
    content,
    hasProductDescription,
    hasDocumentationLinks,
    hasUseCases,
  };
}

function parseRobotsTxt(content: string | null): AIDiscoveryFiles["robotsTxt"] {
  if (!content) {
    return {
      exists: false,
      content: null,
      allowsAICrawlers: false,
      blocksAICrawlers: false,
      mentionsSitemap: false,
      aiCrawlerRules: [],
    };
  }

  const lines = content.split("\n").map((l) => l.trim());
  const aiCrawlerRules: string[] = [];
  let currentAgent = "";
  let allowsAI = false;
  let blocksAI = false;

  for (const line of lines) {
    if (line.startsWith("#")) continue;

    const userAgentMatch = line.match(/^User-agent:\s*(.+)/i);
    if (userAgentMatch) {
      currentAgent = userAgentMatch[1].trim();
      continue;
    }

    const isAICrawler =
      currentAgent === "*" ||
      AI_CRAWLER_USER_AGENTS.some(
        (ua) => currentAgent.toLowerCase().includes(ua.toLowerCase())
      );

    if (isAICrawler) {
      const allowMatch = line.match(/^Allow:\s*(.+)/i);
      const disallowMatch = line.match(/^Disallow:\s*(.+)/i);

      if (allowMatch) {
        aiCrawlerRules.push(`${currentAgent}: Allow ${allowMatch[1]}`);
        if (allowMatch[1].trim() === "/" || allowMatch[1].includes("/docs")) {
          allowsAI = true;
        }
      }
      if (disallowMatch) {
        aiCrawlerRules.push(`${currentAgent}: Disallow ${disallowMatch[1]}`);
        if (disallowMatch[1].trim() === "/") {
          blocksAI = true;
        }
      }
    }
  }

  const mentionsSitemap = /Sitemap:/i.test(content);

  return {
    exists: true,
    content,
    allowsAICrawlers: allowsAI,
    blocksAICrawlers: blocksAI,
    mentionsSitemap,
    aiCrawlerRules,
  };
}

async function fetchSitemapInfo(
  baseUrl: string,
  timeoutMs: number,
  userAgent: string,
  crawledPageCount: number
): Promise<AIDiscoveryFiles["sitemap"]> {
  const sitemapUrls = [
    `${baseUrl}/sitemap.xml`,
    `${baseUrl}/sitemap_index.xml`,
    `${baseUrl}/sitemap/sitemap.xml`,
  ];

  for (const sitemapUrl of sitemapUrls) {
    const content = await fetchTextFile(sitemapUrl, timeoutMs, userAgent);
    if (content) {
      const locMatches = content.match(/<loc>/gi) || [];
      const urlCount = locMatches.length;
      const hasLastmod = /<lastmod>/i.test(content);
      const coverageRatio = crawledPageCount > 0 
        ? Math.min(1, urlCount / crawledPageCount) 
        : 0;

      return {
        exists: true,
        urlCount,
        hasLastmod,
        coverageRatio,
      };
    }
  }

  return {
    exists: false,
    urlCount: 0,
    hasLastmod: false,
    coverageRatio: 0,
  };
}

async function checkAILandingPage(
  baseUrl: string,
  timeoutMs: number,
  userAgent: string
): Promise<AIDiscoveryFiles["aiLandingPage"]> {
  const aiPageUrls = [
    `${baseUrl}/ai`,
    `${baseUrl}/llm`,
    `${baseUrl}/llms`,
    `${baseUrl}/ai.html`,
    `${baseUrl}/for-ai`,
  ];

  const soft404Patterns = [
    /<title>[^<]*not\s*found[^<]*<\/title>/i,
    /<title>[^<]*404[^<]*<\/title>/i,
    /<title>[^<]*error[^<]*<\/title>/i,
    /<h1>[^<]*not\s*found[^<]*<\/h1>/i,
    /<h1>[^<]*404[^<]*<\/h1>/i,
    /page\s*(not\s*found|doesn't\s*exist)/i,
    /class="[^"]*error-page[^"]*"/i,
    /class="[^"]*not-found[^"]*"/i,
  ];

  const aiContentPatterns = [
    /\bllm\b/i,
    /\blarge\s*language\s*model/i,
    /\bai\s*(agent|assistant|integration)/i,
    /\bfor\s*ai\b/i,
    /\bmachine\s*learning\b/i,
    /\bchatgpt\b/i,
    /\bclaude\b/i,
    /\bgpt\b/i,
  ];

  for (const url of aiPageUrls) {
    try {
      const ssrfCheck = await isSSRFSafe(url);
      if (!ssrfCheck.safe) continue;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": userAgent },
      });

      clearTimeout(timeoutId);

      if (!response.ok) continue;

      const content = await response.text();

      const isSoft404 = soft404Patterns.some((pattern) => pattern.test(content));
      if (isSoft404) continue;

      const hasAIContent = aiContentPatterns.some((pattern) => pattern.test(content));
      if (hasAIContent) {
        return { exists: true, url };
      }
    } catch {
      continue;
    }
  }

  return { exists: false, url: null };
}

export async function fetchAIDiscoveryFiles(
  config: AuditConfig,
  crawledPageCount: number
): Promise<AIDiscoveryFiles> {
  const baseUrl = new URL(config.url);
  const base = `${baseUrl.protocol}//${baseUrl.host}`;

  const [llmsTxtContent, aiTxtContent, robotsTxtContent, sitemap, aiLandingPage] = await Promise.all([
    fetchTextFile(`${base}/llms.txt`, config.timeoutMs, config.userAgent),
    fetchTextFile(`${base}/ai.txt`, config.timeoutMs, config.userAgent),
    fetchTextFile(`${base}/robots.txt`, config.timeoutMs, config.userAgent),
    fetchSitemapInfo(base, config.timeoutMs, config.userAgent, crawledPageCount),
    checkAILandingPage(base, config.timeoutMs, config.userAgent),
  ]);

  const llmsTxt = parseLlmsTxt(llmsTxtContent || aiTxtContent);
  const robotsTxt = parseRobotsTxt(robotsTxtContent);

  return {
    llmsTxt,
    robotsTxt,
    sitemap,
    aiLandingPage,
  };
}
