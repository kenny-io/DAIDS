import type { ExtractedPage, ContentChunk } from "./types";

const DEFAULT_CHUNK_SIZE = 1500;
const MIN_CHUNK_SIZE = 100;
const MAX_CHUNK_SIZE = 3000;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function chunkBySize(
  text: string,
  pageUrl: string,
  headingContext: string | null,
  maxSize: number = DEFAULT_CHUNK_SIZE
): ContentChunk[] {
  const chunks: ContentChunk[] = [];

  if (text.length <= maxSize) {
    if (text.length >= MIN_CHUNK_SIZE) {
      chunks.push({
        pageUrl,
        content: text,
        tokenEstimate: estimateTokens(text),
        headingContext,
      });
    }
    return chunks;
  }

  const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text];
  let currentChunk = "";

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxSize && currentChunk.length >= MIN_CHUNK_SIZE) {
      chunks.push({
        pageUrl,
        content: currentChunk.trim(),
        tokenEstimate: estimateTokens(currentChunk),
        headingContext,
      });
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }

  if (currentChunk.trim().length >= MIN_CHUNK_SIZE) {
    chunks.push({
      pageUrl,
      content: currentChunk.trim(),
      tokenEstimate: estimateTokens(currentChunk),
      headingContext,
    });
  }

  return chunks;
}

export function chunkPage(page: ExtractedPage): ContentChunk[] {
  const chunks: ContentChunk[] = [];
  const content = page.mainContent;

  if (!content || content.length < MIN_CHUNK_SIZE) {
    return chunks;
  }

  if (page.headings.length === 0) {
    return chunkBySize(content, page.url, page.title);
  }

  const headingPattern = page.headings
    .map((h) => h.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");

  if (!headingPattern) {
    return chunkBySize(content, page.url, page.title);
  }

  const regex = new RegExp(`(${headingPattern})`, "gi");
  const parts = content.split(regex).filter((p) => p.trim());

  let currentHeading = page.title;
  let currentContent = "";

  for (const part of parts) {
    const matchingHeading = page.headings.find(
      (h) => h.text.toLowerCase() === part.trim().toLowerCase()
    );

    if (matchingHeading) {
      if (currentContent.trim().length >= MIN_CHUNK_SIZE) {
        chunks.push(...chunkBySize(currentContent.trim(), page.url, currentHeading));
      }
      currentHeading = matchingHeading.text;
      currentContent = "";
    } else {
      currentContent += " " + part;
    }
  }

  if (currentContent.trim().length >= MIN_CHUNK_SIZE) {
    chunks.push(...chunkBySize(currentContent.trim(), page.url, currentHeading));
  }

  return chunks;
}

export function chunkAllPages(pages: ExtractedPage[]): ContentChunk[] {
  const allChunks: ContentChunk[] = [];

  for (const page of pages) {
    if (!page.error) {
      allChunks.push(...chunkPage(page));
    }
  }

  return allChunks;
}

export function getChunkStats(chunks: ContentChunk[]): {
  totalChunks: number;
  avgTokens: number;
  minTokens: number;
  maxTokens: number;
  tooShort: number;
  tooLong: number;
} {
  if (chunks.length === 0) {
    return {
      totalChunks: 0,
      avgTokens: 0,
      minTokens: 0,
      maxTokens: 0,
      tooShort: 0,
      tooLong: 0,
    };
  }

  const tokens = chunks.map((c) => c.tokenEstimate);
  const total = tokens.reduce((a, b) => a + b, 0);

  return {
    totalChunks: chunks.length,
    avgTokens: Math.round(total / chunks.length),
    minTokens: Math.min(...tokens),
    maxTokens: Math.max(...tokens),
    tooShort: chunks.filter((c) => c.tokenEstimate < 50).length,
    tooLong: chunks.filter((c) => c.tokenEstimate > 800).length,
  };
}
