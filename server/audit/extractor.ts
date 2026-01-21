import * as cheerio from "cheerio";
import type { ExtractedPage, PageHeading, CodeBlock } from "./types";
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
  $("pre code, pre").each((_, el) => {
    const $el = $(el);
    const content = $el.text().trim();
    if (content.length > 10) {
      const classAttr = $el.attr("class") || "";
      const langMatch = classAttr.match(/(?:language-|lang-)(\w+)/i);
      const dataLang = $el.attr("data-language") || $el.attr("data-lang");
      const language = dataLang || (langMatch ? langMatch[1] : null);
      codeBlocks.push({ language, content });
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
