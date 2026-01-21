import { URL } from "url";
import * as dns from "dns";
import * as net from "net";

const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^fe80:/i,
  /^fc00:/i,
  /^fd00:/i,
];

const BLOCKED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
];

export function isPrivateIP(ip: string): boolean {
  return PRIVATE_IP_RANGES.some((regex) => regex.test(ip));
}

export function isBlockedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return BLOCKED_HOSTS.includes(lower) || lower.endsWith(".local");
}

export async function resolveHostToIP(hostname: string): Promise<string[]> {
  return new Promise((resolve) => {
    dns.lookup(hostname, { all: true }, (err, addresses) => {
      if (err) {
        resolve([]);
      } else {
        resolve(addresses.map((a) => (typeof a === "string" ? a : a.address)));
      }
    });
  });
}

export async function isSSRFSafe(urlString: string): Promise<{ safe: boolean; reason?: string }> {
  try {
    const parsed = new URL(urlString);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { safe: false, reason: `Blocked protocol: ${parsed.protocol}` };
    }

    if (isBlockedHost(parsed.hostname)) {
      return { safe: false, reason: `Blocked host: ${parsed.hostname}` };
    }

    if (net.isIP(parsed.hostname)) {
      if (isPrivateIP(parsed.hostname)) {
        return { safe: false, reason: `Private IP blocked: ${parsed.hostname}` };
      }
    } else {
      const ips = await resolveHostToIP(parsed.hostname);
      for (const ip of ips) {
        if (isPrivateIP(ip)) {
          return { safe: false, reason: `Hostname resolves to private IP: ${ip}` };
        }
      }
    }

    return { safe: true };
  } catch (e) {
    return { safe: false, reason: `Invalid URL: ${e}` };
  }
}

export function normalizeUrl(urlString: string, baseUrl?: string): string | null {
  try {
    const url = baseUrl ? new URL(urlString, baseUrl) : new URL(urlString);

    url.hash = "";

    const paramsToRemove = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref", "source"];
    paramsToRemove.forEach((param) => url.searchParams.delete(param));

    let pathname = url.pathname;
    if (pathname.length > 1 && pathname.endsWith("/")) {
      pathname = pathname.slice(0, -1);
    }
    url.pathname = pathname;

    return url.toString();
  } catch {
    return null;
  }
}

export function isSameOrigin(url1: string, url2: string): boolean {
  try {
    const parsed1 = new URL(url1);
    const parsed2 = new URL(url2);
    return parsed1.origin === parsed2.origin;
  } catch {
    return false;
  }
}

export function getPathDepth(url: string, rootUrl: string): number {
  try {
    const parsedUrl = new URL(url);
    const parsedRoot = new URL(rootUrl);

    const urlPath = parsedUrl.pathname.replace(/\/$/, "");
    const rootPath = parsedRoot.pathname.replace(/\/$/, "");

    const urlSegments = urlPath.split("/").filter(Boolean);
    const rootSegments = rootPath.split("/").filter(Boolean);

    return Math.max(0, urlSegments.length - rootSegments.length);
  } catch {
    return 0;
  }
}

export function getSitemapUrls(rootUrl: string): string[] {
  try {
    const parsed = new URL(rootUrl);
    const base = `${parsed.protocol}//${parsed.host}`;
    return [
      `${base}/sitemap.xml`,
      `${base}/sitemap_index.xml`,
      `${base}/sitemap/sitemap.xml`,
    ];
  } catch {
    return [];
  }
}

export function getRobotsUrl(rootUrl: string): string | null {
  try {
    const parsed = new URL(rootUrl);
    return `${parsed.protocol}//${parsed.host}/robots.txt`;
  } catch {
    return null;
  }
}
