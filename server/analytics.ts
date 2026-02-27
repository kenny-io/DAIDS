import { randomUUID } from "crypto";
import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";
import type { AuditResult } from "./audit/types";
import type {
  AnalyticsSummary,
  AuditAnalyticsEntry,
  ShowcaseResponse,
  ShowcaseSortBy,
  SortDirection,
} from "@shared/analytics-types";

interface ShowcaseQueryOptions {
  page: number;
  limit: number;
  sortBy: ShowcaseSortBy;
  sortDir: SortDirection;
}

const EMPTY_SUMMARY: AnalyticsSummary = {
  totalAudits: 0,
  avgScore: 0,
  topDomains: [],
  scoreDistribution: { "0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0 },
  recentAudits: [],
};

interface IAnalyticsStore {
  recordAudit(result: AuditResult): Promise<AuditAnalyticsEntry>;
  getSummary(): Promise<AnalyticsSummary>;
  getAll(sortBy?: ShowcaseSortBy, sortDir?: SortDirection): Promise<AuditAnalyticsEntry[]>;
  getShowcase(options: ShowcaseQueryOptions): Promise<ShowcaseResponse>;
  getResultById(id: string): Promise<AuditResult | undefined>;
}

function loadLocalEnvFiles(): void {
  const loadEnvFile = (process as unknown as { loadEnvFile?: (path?: string) => void }).loadEnvFile;
  if (typeof loadEnvFile !== "function") {
    return;
  }

  for (const envPath of [".env.local", ".env"]) {
    try {
      loadEnvFile(envPath);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code !== "ENOENT") {
        console.warn(`[analytics] Failed to load ${envPath}:`, error);
      }
    }
  }
}

function getDomainFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/\.$/, "");
    return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
  } catch {
    return url.toLowerCase().replace(/\.$/, "");
  }
}

function toCategoryScores(result: AuditResult): Record<string, number> {
  const categoryScores: Record<string, number> = {};
  for (const category of result.categories) {
    categoryScores[category.name] = category.score;
  }
  return categoryScores;
}

function getSortedEntries(
  entries: AuditAnalyticsEntry[],
  sortBy: ShowcaseSortBy,
  sortDir: SortDirection,
): AuditAnalyticsEntry[] {
  const sorted = [...entries].sort((a, b) => {
    if (sortBy === "score") {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  if (sortDir === "asc") {
    sorted.reverse();
  }

  return sorted;
}

function dedupeEntriesByDomain(entries: AuditAnalyticsEntry[]): AuditAnalyticsEntry[] {
  const latestByDomain = new Map<string, AuditAnalyticsEntry>();

  for (const entry of entries) {
    const existing = latestByDomain.get(entry.domain);
    if (!existing || new Date(entry.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
      latestByDomain.set(entry.domain, entry);
    }
  }

  return Array.from(latestByDomain.values());
}

class MemoryAnalyticsStore implements IAnalyticsStore {
  private entries: AuditAnalyticsEntry[] = [];
  private results: Map<string, AuditResult> = new Map();

  async recordAudit(result: AuditResult): Promise<AuditAnalyticsEntry> {
    const domain = getDomainFromUrl(result.rootUrl);

    const replaced = this.entries.filter((entry) => entry.domain === domain);
    if (replaced.length > 0) {
      this.entries = this.entries.filter((entry) => entry.domain !== domain);
      for (const item of replaced) {
        this.results.delete(item.id);
      }
    }

    const entry: AuditAnalyticsEntry = {
      id: randomUUID(),
      url: result.rootUrl,
      domain,
      score: result.score,
      crawledPages: result.crawledPages,
      categoryScores: toCategoryScores(result),
      durationMs: result.meta.durationMs,
      errorCount: result.meta.errorCount,
      createdAt: new Date().toISOString(),
    };

    this.entries.unshift(entry);
    this.results.set(entry.id, result);

    if (this.entries.length > 1000) {
      const removed = this.entries.splice(1000);
      for (const item of removed) {
        this.results.delete(item.id);
      }
    }

    return entry;
  }

  async getSummary(): Promise<AnalyticsSummary> {
    const uniqueEntries = dedupeEntriesByDomain(this.entries);
    const totalAudits = uniqueEntries.length;

    if (totalAudits === 0) {
      return EMPTY_SUMMARY;
    }

    const avgScore = Math.round(uniqueEntries.reduce((sum, item) => sum + item.score, 0) / totalAudits);

    const domainMap = new Map<string, { count: number; totalScore: number }>();
    for (const entry of uniqueEntries) {
      const existing = domainMap.get(entry.domain) || { count: 0, totalScore: 0 };
      existing.count += 1;
      existing.totalScore += entry.score;
      domainMap.set(entry.domain, existing);
    }

    const topDomains = Array.from(domainMap.entries())
      .map(([domain, data]) => ({
        domain,
        count: data.count,
        avgScore: Math.round(data.totalScore / data.count),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const scoreDistribution: Record<string, number> = {
      "0-20": 0,
      "21-40": 0,
      "41-60": 0,
      "61-80": 0,
      "81-100": 0,
    };

    for (const entry of uniqueEntries) {
      if (entry.score <= 20) scoreDistribution["0-20"] += 1;
      else if (entry.score <= 40) scoreDistribution["21-40"] += 1;
      else if (entry.score <= 60) scoreDistribution["41-60"] += 1;
      else if (entry.score <= 80) scoreDistribution["61-80"] += 1;
      else scoreDistribution["81-100"] += 1;
    }

    return {
      totalAudits,
      avgScore,
      topDomains,
      scoreDistribution,
      recentAudits: getSortedEntries(uniqueEntries, "createdAt", "desc").slice(0, 20),
    };
  }

  async getAll(sortBy: ShowcaseSortBy = "createdAt", sortDir: SortDirection = "desc"): Promise<AuditAnalyticsEntry[]> {
    return getSortedEntries(dedupeEntriesByDomain(this.entries), sortBy, sortDir);
  }

  async getShowcase({ page, limit, sortBy, sortDir }: ShowcaseQueryOptions): Promise<ShowcaseResponse> {
    const ordered = getSortedEntries(dedupeEntriesByDomain(this.entries), sortBy, sortDir);
    const totalItems = ordered.length;
    const totalPages = Math.ceil(totalItems / limit);
    const offset = (page - 1) * limit;

    return {
      items: ordered.slice(offset, offset + limit),
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async getResultById(id: string): Promise<AuditResult | undefined> {
    return this.results.get(id);
  }
}

class PostgresAnalyticsStore implements IAnalyticsStore {
  private readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  private mapEntryRow(row: {
    id: string;
    url: string;
    domain: string;
    score: number;
    crawled_pages: number;
    category_scores: Record<string, number>;
    duration_ms: number;
    error_count: number;
    created_at: string | Date;
  }): AuditAnalyticsEntry {
    return {
      id: row.id,
      url: row.url,
      domain: row.domain,
      score: row.score,
      crawledPages: row.crawled_pages,
      categoryScores: row.category_scores ?? {},
      durationMs: row.duration_ms,
      errorCount: row.error_count,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  private getOrderClause(sortBy: ShowcaseSortBy, sortDir: SortDirection): string {
    const by = sortBy === "score" ? "score" : "created_at";
    const dir = sortDir === "asc" ? "ASC" : "DESC";

    if (by === "score") {
      return `score ${dir}, created_at DESC`;
    }

    return `created_at ${dir}`;
  }

  async recordAudit(result: AuditResult): Promise<AuditAnalyticsEntry> {
    const domain = getDomainFromUrl(result.rootUrl);
    const categoryScores = toCategoryScores(result);

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const insertEntryResult = await client.query<{
        id: string;
        url: string;
        domain: string;
        score: number;
        crawled_pages: number;
        category_scores: Record<string, number>;
        duration_ms: number;
        error_count: number;
        created_at: string;
      }>(
        `
        INSERT INTO audit_entries (
          url, domain, score, crawled_pages, category_scores, duration_ms, error_count
        ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
        ON CONFLICT (domain) DO UPDATE
        SET
          url = EXCLUDED.url,
          score = EXCLUDED.score,
          crawled_pages = EXCLUDED.crawled_pages,
          category_scores = EXCLUDED.category_scores,
          duration_ms = EXCLUDED.duration_ms,
          error_count = EXCLUDED.error_count,
          created_at = now()
        RETURNING id, url, domain, score, crawled_pages, category_scores, duration_ms, error_count, created_at
        `,
        [
          result.rootUrl,
          domain,
          result.score,
          result.crawledPages,
          JSON.stringify(categoryScores),
          result.meta.durationMs,
          result.meta.errorCount,
        ],
      );

      const entry = insertEntryResult.rows[0];

      await client.query(
        `
        INSERT INTO audit_results (entry_id, result_json)
        VALUES ($1::uuid, $2::jsonb)
        ON CONFLICT (entry_id) DO UPDATE
        SET result_json = EXCLUDED.result_json, created_at = now()
        `,
        [entry.id, JSON.stringify(result)],
      );

      await client.query("COMMIT");
      return this.mapEntryRow(entry);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getSummary(): Promise<AnalyticsSummary> {
    const totalsResult = await this.pool.query<{ total_audits: string; avg_score: string }>(
      `
      WITH latest_entries AS (
        SELECT DISTINCT ON (domain)
          id, domain, score, created_at
        FROM audit_entries
        ORDER BY domain, created_at DESC
      )
      SELECT
        COUNT(*)::text AS total_audits,
        COALESCE(ROUND(AVG(score)), 0)::text AS avg_score
      FROM latest_entries
      `,
    );

    const totalAudits = parseInt(totalsResult.rows[0]?.total_audits ?? "0", 10);
    const avgScore = parseInt(totalsResult.rows[0]?.avg_score ?? "0", 10);

    if (totalAudits === 0) {
      return EMPTY_SUMMARY;
    }

    const [topDomainsResult, distributionResult, recentResult] = await Promise.all([
      this.pool.query<{ domain: string; count: string; avg_score: string }>(
        `
        WITH latest_entries AS (
          SELECT DISTINCT ON (domain)
            domain, score, created_at
          FROM audit_entries
          ORDER BY domain, created_at DESC
        )
        SELECT domain, COUNT(*)::text AS count, ROUND(AVG(score))::text AS avg_score
        FROM latest_entries
        GROUP BY domain
        ORDER BY COUNT(*) DESC
        LIMIT 10
        `,
      ),
      this.pool.query<{
        score_0_20: string;
        score_21_40: string;
        score_41_60: string;
        score_61_80: string;
        score_81_100: string;
      }>(
        `
        WITH latest_entries AS (
          SELECT DISTINCT ON (domain)
            id, domain, score
          FROM audit_entries
          ORDER BY domain, created_at DESC
        )
        SELECT
          COUNT(*) FILTER (WHERE score <= 20)::text AS score_0_20,
          COUNT(*) FILTER (WHERE score > 20 AND score <= 40)::text AS score_21_40,
          COUNT(*) FILTER (WHERE score > 40 AND score <= 60)::text AS score_41_60,
          COUNT(*) FILTER (WHERE score > 60 AND score <= 80)::text AS score_61_80,
          COUNT(*) FILTER (WHERE score > 80)::text AS score_81_100
        FROM latest_entries
        `,
      ),
      this.pool.query<{
        id: string;
        url: string;
        domain: string;
        score: number;
        crawled_pages: number;
        category_scores: Record<string, number>;
        duration_ms: number;
        error_count: number;
        created_at: string;
      }>(
        `
        WITH latest_entries AS (
          SELECT DISTINCT ON (domain)
            id, url, domain, score, crawled_pages, category_scores, duration_ms, error_count, created_at
          FROM audit_entries
          ORDER BY domain, created_at DESC
        )
        SELECT id, url, domain, score, crawled_pages, category_scores, duration_ms, error_count, created_at
        FROM latest_entries
        ORDER BY created_at DESC
        LIMIT 20
        `,
      ),
    ]);

    const distributionRow = distributionResult.rows[0];

    return {
      totalAudits,
      avgScore,
      topDomains: topDomainsResult.rows.map((row) => ({
        domain: row.domain,
        count: parseInt(row.count, 10),
        avgScore: parseInt(row.avg_score, 10),
      })),
      scoreDistribution: {
        "0-20": parseInt(distributionRow.score_0_20, 10),
        "21-40": parseInt(distributionRow.score_21_40, 10),
        "41-60": parseInt(distributionRow.score_41_60, 10),
        "61-80": parseInt(distributionRow.score_61_80, 10),
        "81-100": parseInt(distributionRow.score_81_100, 10),
      },
      recentAudits: recentResult.rows.map((row) => this.mapEntryRow(row)),
    };
  }

  async getAll(sortBy: ShowcaseSortBy = "createdAt", sortDir: SortDirection = "desc"): Promise<AuditAnalyticsEntry[]> {
    const orderClause = this.getOrderClause(sortBy, sortDir);
    const result = await this.pool.query<{
      id: string;
      url: string;
      domain: string;
      score: number;
      crawled_pages: number;
      category_scores: Record<string, number>;
      duration_ms: number;
      error_count: number;
      created_at: string;
    }>(
      `
      WITH latest_entries AS (
        SELECT DISTINCT ON (domain)
          id, url, domain, score, crawled_pages, category_scores, duration_ms, error_count, created_at
        FROM audit_entries
        ORDER BY domain, created_at DESC
      )
      SELECT id, url, domain, score, crawled_pages, category_scores, duration_ms, error_count, created_at
      FROM latest_entries
      ORDER BY ${orderClause}
      `,
    );

    return result.rows.map((row) => this.mapEntryRow(row));
  }

  async getShowcase({ page, limit, sortBy, sortDir }: ShowcaseQueryOptions): Promise<ShowcaseResponse> {
    const orderClause = this.getOrderClause(sortBy, sortDir);
    const offset = (page - 1) * limit;

    const [countResult, itemsResult] = await Promise.all([
      this.pool.query<{ total_items: string }>(`
        WITH latest_entries AS (
          SELECT DISTINCT ON (domain)
            id
          FROM audit_entries
          ORDER BY domain, created_at DESC
        )
        SELECT COUNT(*)::text AS total_items FROM latest_entries
      `),
      this.pool.query<{
        id: string;
        url: string;
        domain: string;
        score: number;
        crawled_pages: number;
        category_scores: Record<string, number>;
        duration_ms: number;
        error_count: number;
        created_at: string;
      }>(
        `
        WITH latest_entries AS (
          SELECT DISTINCT ON (domain)
            id, url, domain, score, crawled_pages, category_scores, duration_ms, error_count, created_at
          FROM audit_entries
          ORDER BY domain, created_at DESC
        )
        SELECT id, url, domain, score, crawled_pages, category_scores, duration_ms, error_count, created_at
        FROM latest_entries
        ORDER BY ${orderClause}
        LIMIT $1 OFFSET $2
        `,
        [limit, offset],
      ),
    ]);

    const totalItems = parseInt(countResult.rows[0]?.total_items ?? "0", 10);
    const totalPages = Math.ceil(totalItems / limit);

    return {
      items: itemsResult.rows.map((row) => this.mapEntryRow(row)),
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async getResultById(id: string): Promise<AuditResult | undefined> {
    const result = await this.pool.query<{ result_json: AuditResult }>(
      `SELECT result_json FROM audit_results WHERE entry_id = $1::uuid LIMIT 1`,
      [id],
    );

    return result.rows[0]?.result_json;
  }
}

class SupabaseAnalyticsStore implements IAnalyticsStore {
  private readonly supabase;

  constructor(supabaseUrl: string, serviceRoleKey: string) {
    this.supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  private mapRow(row: Record<string, unknown>): AuditAnalyticsEntry {
    return {
      id: row.id as string,
      url: row.url as string,
      domain: row.domain as string,
      score: row.score as number,
      crawledPages: row.crawled_pages as number,
      categoryScores: (row.category_scores as Record<string, number>) ?? {},
      durationMs: row.duration_ms as number,
      errorCount: row.error_count as number,
      createdAt: new Date(row.created_at as string).toISOString(),
    };
  }

  async recordAudit(result: AuditResult): Promise<AuditAnalyticsEntry> {
    const domain = getDomainFromUrl(result.rootUrl);
    const categoryScores = toCategoryScores(result);

    const { data: entry, error: entryError } = await this.supabase
      .from("audit_entries")
      .upsert(
        {
          url: result.rootUrl,
          domain,
          score: result.score,
          crawled_pages: result.crawledPages,
          category_scores: categoryScores,
          duration_ms: result.meta.durationMs,
          error_count: result.meta.errorCount,
          created_at: new Date().toISOString(),
        },
        { onConflict: "domain" },
      )
      .select()
      .single();

    if (entryError) throw entryError;

    const { error: resultError } = await this.supabase
      .from("audit_results")
      .upsert(
        { entry_id: entry.id, result_json: result, created_at: new Date().toISOString() },
        { onConflict: "entry_id" },
      );

    if (resultError) throw resultError;

    return this.mapRow(entry as Record<string, unknown>);
  }

  async getSummary(): Promise<AnalyticsSummary> {
    const { data: entries, count, error } = await this.supabase
      .from("audit_entries")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (error) throw error;

    const totalAudits = count ?? 0;
    if (totalAudits === 0) return EMPTY_SUMMARY;

    const rows = entries as Record<string, unknown>[];
    const avgScore = Math.round(rows.reduce((sum, e) => sum + (e.score as number), 0) / totalAudits);

    const domainMap = new Map<string, { count: number; totalScore: number }>();
    for (const e of rows) {
      const d = e.domain as string;
      const existing = domainMap.get(d) || { count: 0, totalScore: 0 };
      existing.count += 1;
      existing.totalScore += e.score as number;
      domainMap.set(d, existing);
    }

    const topDomains = Array.from(domainMap.entries())
      .map(([domain, data]) => ({ domain, count: data.count, avgScore: Math.round(data.totalScore / data.count) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const scoreDistribution: Record<string, number> = { "0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0 };
    for (const e of rows) {
      const s = e.score as number;
      if (s <= 20) scoreDistribution["0-20"] += 1;
      else if (s <= 40) scoreDistribution["21-40"] += 1;
      else if (s <= 60) scoreDistribution["41-60"] += 1;
      else if (s <= 80) scoreDistribution["61-80"] += 1;
      else scoreDistribution["81-100"] += 1;
    }

    return {
      totalAudits,
      avgScore,
      topDomains,
      scoreDistribution,
      recentAudits: rows.slice(0, 20).map((r) => this.mapRow(r)),
    };
  }

  async getAll(sortBy: ShowcaseSortBy = "createdAt", sortDir: SortDirection = "desc"): Promise<AuditAnalyticsEntry[]> {
    const column = sortBy === "score" ? "score" : "created_at";
    const ascending = sortDir === "asc";

    const query = this.supabase.from("audit_entries").select("*").order(column, { ascending });
    if (column !== "created_at") {
      query.order("created_at", { ascending: false });
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data as Record<string, unknown>[]).map((r) => this.mapRow(r));
  }

  async getShowcase({ page, limit, sortBy, sortDir }: ShowcaseQueryOptions): Promise<ShowcaseResponse> {
    const column = sortBy === "score" ? "score" : "created_at";
    const ascending = sortDir === "asc";
    const offset = (page - 1) * limit;

    const query = this.supabase
      .from("audit_entries")
      .select("*", { count: "exact" })
      .order(column, { ascending })
      .range(offset, offset + limit - 1);
    if (column !== "created_at") {
      query.order("created_at", { ascending: false });
    }

    const { data, count, error } = await query;
    if (error) throw error;

    const totalItems = count ?? 0;
    const totalPages = Math.ceil(totalItems / limit);

    return {
      items: (data as Record<string, unknown>[]).map((r) => this.mapRow(r)),
      pagination: { page, limit, totalItems, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    };
  }

  async getResultById(id: string): Promise<AuditResult | undefined> {
    const { data, error } = await this.supabase
      .from("audit_results")
      .select("result_json")
      .eq("entry_id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return undefined;
      throw error;
    }

    return (data as { result_json: AuditResult })?.result_json;
  }
}

loadLocalEnvFiles();

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function createAnalyticsStore(): IAnalyticsStore {
  if (databaseUrl) {
    console.log("[analytics] Using Postgres analytics store.");
    return new PostgresAnalyticsStore(databaseUrl);
  }
  if (supabaseUrl && supabaseServiceRoleKey) {
    console.log("[analytics] Using Supabase analytics store.");
    return new SupabaseAnalyticsStore(supabaseUrl, supabaseServiceRoleKey);
  }
  console.warn("[analytics] DATABASE_URL / SUPABASE_URL not set, falling back to in-memory analytics store.");
  return new MemoryAnalyticsStore();
}

export const analyticsStore: IAnalyticsStore = createAnalyticsStore();
