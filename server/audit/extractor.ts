import * as cheerio from "cheerio";
import type { ExtractedPage, PageHeading, CodeBlock, FAQItem } from "./types";
import { normalizeUrl, isSameOrigin } from "./url-utils";

const BOILERPLATE_SELECTORS = [
  "nav",
  "header",
  "footer",
  "aside",
  ".sidebar",
  ".navigation",
  ".nav",
  ".menu",
  ".header",
  ".footer",
  ".breadcrumb",
  ".toc",
  ".table-of-contents",
  "#toc",
  "[role='navigation']",
  "[role='banner']",
  "[role='contentinfo']",
  "script",
  "style",
  "noscript",
  "iframe",
  "svg",
];

function extractJsonLdData(html: string): { types: string[]; hasFAQ: boolean } {
  const types: string[] = [];
  let hasFAQ = false;

  const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  
  for (const match of jsonLdMatches) {
    try {
      const jsonContent = match.replace(/<script[^>]*>|<\/script>/gi, "").trim();
      const data = JSON.parse(jsonContent);
      
      const extractTypes = (obj: any): void => {
        if (!obj || typeof obj !== "object") return;
        
        if (Array.isArray(obj)) {
          obj.forEach(extractTypes);
          return;
        }
        
        if (obj["@type"]) {
          const typeVal = Array.isArray(obj["@type"]) ? obj["@type"] : [obj["@type"]];
          types.push(...typeVal);
          if (typeVal.some((t: string) => t.toLowerCase().includes("faq"))) {
            hasFAQ = true;
          }
        }
        if (obj["@graph"] && Array.isArray(obj["@graph"])) {
          obj["@graph"].forEach(extractTypes);
        }
        for (const key of Object.keys(obj)) {
          if (key !== "@graph" && typeof obj[key] === "object" && obj[key] !== null) {
            extractTypes(obj[key]);
          }
        }
      };
      
      extractTypes(data);
    } catch {
      continue;
    }
  }

  return { types: Array.from(new Set(types)), hasFAQ };
}

function extractFAQItems($: cheerio.CheerioAPI): FAQItem[] {
  const faqItems: FAQItem[] = [];
  
  $('[itemtype*="FAQPage"] [itemprop="mainEntity"], .faq-item, .faq-question, [data-faq]').each((_, el) => {
    const $el = $(el);
    const question = $el.find('[itemprop="name"], .question, h3, h4').first().text().trim();
    const answer = $el.find('[itemprop="acceptedAnswer"], .answer, p').first().text().trim();
    if (question && answer) {
      faqItems.push({ question, answer });
    }
  });

  $("details summary, .accordion-header, [data-accordion]").each((_, el) => {
    const $el = $(el);
    const question = $el.text().trim();
    const answer = $el.next().text().trim() || $el.parent().find(".accordion-content, .accordion-body").text().trim();
    if (question && answer && question.length < 200) {
      faqItems.push({ question, answer });
    }
  });

  return faqItems.slice(0, 50);
}

function detectOpenAPILink($: cheerio.CheerioAPI, url: string): { hasLink: boolean; openAPIUrl: string | null } {
  const openAPIPatterns = [
    /openapi\.json/i,
    /openapi\.ya?ml/i,
    /swagger\.json/i,
    /swagger\.ya?ml/i,
    /api-spec/i,
    /api\.json/i,
  ];

  let openAPIUrl: string | null = null;

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (openAPIPatterns.some((p) => p.test(href))) {
      openAPIUrl = normalizeUrl(href, url);
      return false;
    }
  });

  $('link[rel="api"], link[type*="openapi"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      openAPIUrl = normalizeUrl(href, url);
      return false;
    }
  });

  return { hasLink: !!openAPIUrl, openAPIUrl };
}

function detectPrerequisites($: cheerio.CheerioAPI, mainContent: string): boolean {
  const prereqPatterns = [
    /prerequisites?/i,
    /requirements?/i,
    /before\s+you\s+begin/i,
    /what\s+you['']?ll?\s+need/i,
    /dependencies/i,
    /setup\s+requirements/i,
  ];

  const headingText = $("h1, h2, h3, h4").map((_, el) => $(el).text()).get().join(" ");
  return prereqPatterns.some((p) => p.test(headingText) || p.test(mainContent.slice(0, 2000)));
}

function countExternalLinks($: cheerio.CheerioAPI, url: string): number {
  let count = 0;
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (href && href.startsWith("http") && !isSameOrigin(href, url)) {
      count++;
    }
  });
  return count;
}

export function extractPageData(
  html: string,
  url: string,
  statusCode: number
): ExtractedPage {
  const $ = cheerio.load(html);

  const title = $("title").first().text().trim() || null;

  const canonical =
    $('link[rel="canonical"]').attr("href") ||
    $('meta[property="og:url"]').attr("content") ||
    null;

  const metaDescription =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    null;

  const headings: PageHeading[] = [];
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const tagName = $(el).prop("tagName");
    if (tagName) {
      const level = parseInt(tagName.charAt(1), 10);
      const text = $(el).text().trim();
      if (text) {
        headings.push({ level, text });
      }
    }
  });

  const codeBlocks: CodeBlock[] = [];
  const codeLanguages: string[] = [];
  $("pre code, pre").each((_, el) => {
    const $el = $(el);
    const content = $el.text().trim();
    if (content.length > 10) {
      const classAttr = $el.attr("class") || "";
      const langMatch = classAttr.match(/(?:language-|lang-)(\w+)/i);
      const dataLang = $el.attr("data-language") || $el.attr("data-lang");
      const language = dataLang || (langMatch ? langMatch[1] : null);
      codeBlocks.push({ language, content });
      if (language && !codeLanguages.includes(language.toLowerCase())) {
        codeLanguages.push(language.toLowerCase());
      }
    }
  });

  const internalLinks: string[] = [];
  const seenLinks = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      const normalized = normalizeUrl(href, url);
      if (normalized && isSameOrigin(normalized, url) && !seenLinks.has(normalized)) {
        seenLinks.add(normalized);
        internalLinks.push(normalized);
      }
    }
  });

  const $content = $("body").clone();
  BOILERPLATE_SELECTORS.forEach((sel) => {
    $content.find(sel).remove();
  });

  const mainSelectors = ["main", "article", '[role="main"]', ".content", ".main", "#content", "#main"];
  let mainContent = "";

  for (const sel of mainSelectors) {
    const $main = $content.find(sel);
    if ($main.length) {
      mainContent = $main.text().replace(/\s+/g, " ").trim();
      break;
    }
  }

  if (!mainContent) {
    mainContent = $content.text().replace(/\s+/g, " ").trim();
  }

  const jsonLdData = extractJsonLdData(html);
  const faqItems = extractFAQItems($);
  const openAPIInfo = detectOpenAPILink($, url);
  const hasPrerequisites = detectPrerequisites($, mainContent);
  const externalLinkCount = countExternalLinks($, url);

  const scriptCount = $("script").length;
  const htmlSize = html.length;
  const textToHtmlRatio = mainContent.length / Math.max(1, htmlSize);

  return {
    url,
    title,
    canonical,
    metaDescription,
    headings,
    codeBlocks,
    internalLinks,
    mainContent,
    rawHtml: html,
    statusCode,
    hasJsonLd: jsonLdData.types.length > 0,
    jsonLdTypes: jsonLdData.types,
    hasFAQSchema: jsonLdData.hasFAQ,
    faqItems,
    hasOpenAPILink: openAPIInfo.hasLink,
    openAPIUrl: openAPIInfo.openAPIUrl,
    hasPrerequisites,
    internalLinkCount: internalLinks.length,
    externalLinkCount,
    codeLanguages,
    scriptCount,
    htmlSize,
    textToHtmlRatio,
  };
}

export function detectJSRendered(pages: ExtractedPage[]): boolean {
  if (pages.length === 0) return false;

  let emptyContentCount = 0;
  for (const page of pages) {
    if (page.mainContent.length < 100 && page.headings.length === 0) {
      emptyContentCount++;
    }
  }

  return emptyContentCount / pages.length > 0.5;
}
