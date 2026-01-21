# Docs AI Discoverability Scorer (DAIDS)

A TypeScript Node.js CLI + API tool that audits documentation URLs for AI agent discoverability.

## Overview

DAIDS crawls documentation sites like an AI indexing agent would and produces a score (0-100) showing how primed the docs are for AI discoverability and agent usability.

## Features

- **CLI Tool**: Run audits from the command line
- **REST API**: POST /api/audit endpoint for programmatic access
- **5 Scoring Categories**:
  1. Agent discovery readiness (titles, meta descriptions, canonicals)
  2. Structure and chunkability (headings, page structure)
  3. Retrieval self-containment (chunk quality, context)
  4. Agent usability for developers (code examples, language tags)
  5. Trust and freshness signals (last updated, changelogs)

## Security

- SSRF protection blocks localhost, private IP ranges
- Only HTTP/HTTPS protocols allowed
- Internal links only (no external domain crawling)

## CLI Usage

```bash
npx tsx server/cli.ts <url> [options]

# Options:
#   --maxPages <number>     Maximum pages to crawl (default: 150)
#   --maxDepth <number>     Maximum crawl depth (default: 3)
#   --concurrency <number>  Concurrent requests (default: 8)
#   --timeoutMs <number>    Request timeout in ms (default: 12000)
#   --userAgent <string>    User agent string (default: docs-ai-audit/1.0)
```

## API Usage

```bash
POST /api/audit
Content-Type: application/json

{
  "url": "https://docs.example.com",
  "maxPages": 150,
  "maxDepth": 3
}
```

## Response Format

```json
{
  "rootUrl": "https://docs.example.com",
  "crawledPages": 120,
  "score": 78,
  "categories": [
    {
      "name": "Agent discovery readiness",
      "score": 16,
      "max": 20,
      "findings": [...]
    }
  ],
  "topFindings": [...],
  "meta": {
    "chunkCount": 400,
    "durationMs": 42000,
    "errorCount": 3
  }
}
```

## Project Structure

```
server/
  audit/
    types.ts      - TypeScript interfaces and Zod schemas
    url-utils.ts  - URL normalization and SSRF protection
    crawler.ts    - Site crawler with concurrency control
    extractor.ts  - HTML content extraction
    chunker.ts    - Content chunking logic
    scorer.ts     - 5-category scoring system
    index.ts      - Main audit runner
  cli.ts          - Commander CLI tool
  routes.ts       - Express API routes
```

## Tech Stack

- Node.js 20+
- TypeScript
- Cheerio (HTML parsing)
- p-limit (concurrency)
- Commander (CLI)
- Express (API)
- Zod (validation)
