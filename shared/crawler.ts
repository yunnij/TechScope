import { ENABLED_SOURCES, SOURCES } from "./sources";
import { parseFeedXml } from "./rss";
import { inferTopics } from "./topics";
import type { CrawlResult, CrawlRunReport, CrawlSummary, PostRecord, SourceConfig } from "./types";

interface DbLike {
  prepare(query: string): {
    bind(...args: unknown[]): {
      run<T = unknown>(): Promise<T>;
      first?<T = unknown>(): Promise<T | null>;
    };
  };
}

interface D1RunResultMetaLike {
  last_row_id?: number;
}

interface D1RunResultLike {
  meta?: D1RunResultMetaLike;
}

export interface RunCrawlJobOptions {
  triggerType?: "cron" | "manual" | "api";
  triggerRef?: string | null;
  sourceIds?: string[];
  persistRunLog?: boolean;
}

const DEFAULT_FETCH_TIMEOUT_MS = 15000;
const DEFAULT_FETCH_RETRIES = 2;
const CRAWL_LOG_RETENTION_DAYS = 7;
const DEFAULT_FEED_HEADERS: Record<string, string> = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 TechScopeBot/0.3",
  accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.8",
  "cache-control": "no-cache"
};
const DEFAULT_PAGE_HEADERS: Record<string, string> = {
  "user-agent": DEFAULT_FEED_HEADERS["user-agent"],
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "cache-control": "no-cache"
};

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url.trim();
  }
}

async function upsertPost(db: DbLike, post: PostRecord): Promise<void> {
  const sql = `
    INSERT INTO posts (
      source_id, company, title, url, published_at, primary_topic, topics_json, summary, fetched_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(url) DO UPDATE SET
      source_id = excluded.source_id,
      company = excluded.company,
      title = excluded.title,
      published_at = COALESCE(excluded.published_at, posts.published_at),
      primary_topic = excluded.primary_topic,
      topics_json = excluded.topics_json,
      summary = COALESCE(excluded.summary, posts.summary),
      fetched_at = excluded.fetched_at,
      updated_at = excluded.updated_at
  `;
  await db
    .prepare(sql)
    .bind(
      post.sourceId,
      post.company,
      post.title,
      post.url,
      post.publishedAt,
      post.primaryTopic,
      JSON.stringify(post.topics),
      post.summary,
      post.fetchedAt,
      post.fetchedAt
    )
    .run();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: DEFAULT_FEED_HEADERS,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTextWithTimeout(
  url: string,
  headers: Record<string, string>,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFeedWithRetry(source: SourceConfig): Promise<Response> {
  if (!source.feedUrl) {
    throw new Error("feedUrl is missing");
  }

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= DEFAULT_FETCH_RETRIES + 1; attempt += 1) {
    try {
      const res = await fetchWithTimeout(source.feedUrl);
      if (!res.ok) {
        const contentType = res.headers.get("content-type") ?? "unknown";
        throw new Error(`HTTP ${res.status} (${contentType}) [attempt ${attempt}]`);
      }
      return res;
    } catch (error) {
      lastError = error;
      if (attempt <= DEFAULT_FETCH_RETRIES) {
        await sleep(300 * attempt);
        continue;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function extractPublishedDateFromArticleHtml(html: string): string | null {
  const candidates = [
    /"datePublished"\s*:\s*"([^"]+)"/i,
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:published_time["']/i,
    /<meta[^>]+itemprop=["']datePublished["'][^>]+content=["']([^"']+)["']/i,
    /<time[^>]+datetime=["']([^"']+)["']/i
  ];

  for (const regex of candidates) {
    const raw = html.match(regex)?.[1]?.trim();
    if (!raw) continue;
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }

  return null;
}

async function enrichPublishedDatesFromPages(source: SourceConfig, posts: PostRecord[]): Promise<void> {
  if (!source.resolvePublishedAtFromPage) return;

  for (const post of posts) {
    if (post.publishedAt) continue;
    try {
      const res = await fetchTextWithTimeout(post.url, DEFAULT_PAGE_HEADERS, 12000);
      if (!res.ok) continue;
      const html = await res.text();
      const publishedAt = extractPublishedDateFromArticleHtml(html);
      if (publishedAt) post.publishedAt = publishedAt;
      await sleep(80);
    } catch {
      // Best-effort enrichment only. Keep null and fallback to fetchedAt in UI.
    }
  }
}

async function fetchSource(source: SourceConfig): Promise<PostRecord[]> {
  if (!source.feedUrl) return [];

  const res = await fetchFeedWithRetry(source);

  const xml = await res.text();
  const items = parseFeedXml(xml);
  const fetchedAt = new Date().toISOString();
  const seenNormalized = new Set<string>();

  const posts: PostRecord[] = [];
  for (const item of items) {
    const normalized = normalizeUrl(item.url);
    if (!normalized || seenNormalized.has(normalized)) continue;
    seenNormalized.add(normalized);
    const topics = inferTopics(item);
    posts.push({
      sourceId: source.id,
      company: source.company,
      title: item.title.trim(),
      url: normalized,
      publishedAt: item.publishedAt,
      primaryTopic: topics[0],
      topics,
      summary: item.summary,
      fetchedAt
    });
  }

  if (source.maxItems && source.maxItems > 0) {
    const limited = posts.slice(0, source.maxItems);
    await enrichPublishedDatesFromPages(source, limited);
    return limited;
  }

  await enrichPublishedDatesFromPages(source, posts);
  return posts;
}

function summarize(results: CrawlResult[]): { summary: CrawlSummary; status: CrawlRunReport["status"] } {
  const summary = results.reduce<CrawlSummary>(
    (acc, row) => {
      acc.fetched += row.fetched;
      acc.upserted += row.upserted;
      acc.skipped += row.skipped;
      if (row.error) acc.errors += 1;
      return acc;
    },
    { fetched: 0, upserted: 0, skipped: 0, errors: 0 }
  );

  const successCount = results.filter((r) => !r.error).length;
  let status: CrawlRunReport["status"] = "success";
  if (summary.errors > 0 && successCount === 0) status = "failed";
  else if (summary.errors > 0) status = "partial";

  return { summary, status };
}

async function insertCrawlRun(
  db: DbLike,
  options: Required<Pick<RunCrawlJobOptions, "triggerType">> & { triggerRef: string | null; startedAt: string; sourceCount: number }
): Promise<number | null> {
  const result = (await db
    .prepare(
      `INSERT INTO crawl_runs (trigger_type, trigger_ref, status, source_count, started_at)
       VALUES (?, ?, 'running', ?, ?)`
    )
    .bind(options.triggerType, options.triggerRef, options.sourceCount, options.startedAt)
    .run()) as D1RunResultLike;

  return result?.meta?.last_row_id ?? null;
}

async function insertCrawlRunResult(db: DbLike, runId: number, row: CrawlResult): Promise<void> {
  await db
    .prepare(
      `INSERT INTO crawl_run_results (
         crawl_run_id, source_id, company, fetched_count, upserted_count, skipped_count, status, error_message
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      runId,
      row.sourceId,
      row.company,
      row.fetched,
      row.upserted,
      row.skipped,
      row.error ? "failed" : "success",
      row.error ?? null
    )
    .run();
}

async function finalizeCrawlRun(
  db: DbLike,
  runId: number,
  finishedAt: string,
  status: CrawlRunReport["status"],
  summary: CrawlSummary
): Promise<void> {
  await db
    .prepare(
      `UPDATE crawl_runs
       SET status = ?, fetched_count = ?, upserted_count = ?, skipped_count = ?, error_count = ?, finished_at = ?
       WHERE id = ?`
    )
    .bind(status, summary.fetched, summary.upserted, summary.skipped, summary.errors, finishedAt, runId)
    .run();
}

function getIsoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function cleanupOldCrawlLogs(db: DbLike, retentionDays = CRAWL_LOG_RETENTION_DAYS): Promise<void> {
  const cutoff = getIsoDaysAgo(retentionDays);

  // Delete child rows first to avoid relying on FK cascade behavior/config.
  await db
    .prepare(
      `DELETE FROM crawl_run_results
       WHERE crawl_run_id IN (
         SELECT id FROM crawl_runs WHERE started_at < ?
       )`
    )
    .bind(cutoff)
    .run();

  await db
    .prepare("DELETE FROM crawl_runs WHERE started_at < ?")
    .bind(cutoff)
    .run();
}

function selectSources(sourceIds?: string[]): SourceConfig[] {
  if (!sourceIds || sourceIds.length === 0) return ENABLED_SOURCES;
  const set = new Set(sourceIds);
  return ENABLED_SOURCES.filter((source) => set.has(source.id));
}

export async function runCrawlJob(db: DbLike, options: RunCrawlJobOptions = {}): Promise<CrawlRunReport> {
  const startedAt = new Date().toISOString();
  const sources = selectSources(options.sourceIds);
  const triggerType = options.triggerType ?? "manual";
  const triggerRef = options.triggerRef ?? null;
  let persistRunLog = options.persistRunLog ?? true;

  let runId: number | null = null;
  if (persistRunLog) {
    try {
      runId = await insertCrawlRun(db, {
        triggerType,
        triggerRef,
        startedAt,
        sourceCount: sources.length
      });
    } catch {
      // If crawl log tables are not migrated yet, continue crawling without logs.
      persistRunLog = false;
      runId = null;
    }
  }

  const results: CrawlResult[] = [];
  for (const source of sources) {
    try {
      const posts = await fetchSource(source);
      let upserted = 0;
      let skipped = 0;

      for (const post of posts) {
        if (!post.url) {
          skipped += 1;
          continue;
        }
        await upsertPost(db, post);
        upserted += 1;
      }

      const row: CrawlResult = {
        sourceId: source.id,
        company: source.company,
        fetched: posts.length,
        upserted,
        skipped
      };
      results.push(row);
      if (persistRunLog && runId) await insertCrawlRunResult(db, runId, row);
    } catch (error) {
      const row: CrawlResult = {
        sourceId: source.id,
        company: source.company,
        fetched: 0,
        upserted: 0,
        skipped: 0,
        error:
          error instanceof Error
            ? `[${source.id}] ${error.message} | feed=${source.feedUrl ?? "n/a"}`
            : `[${source.id}] ${String(error)} | feed=${source.feedUrl ?? "n/a"}`
      };
      results.push(row);
      if (persistRunLog && runId) await insertCrawlRunResult(db, runId, row);
    }
  }

  const finishedAt = new Date().toISOString();
  const { summary, status } = summarize(results);

  if (persistRunLog && runId) {
    await finalizeCrawlRun(db, runId, finishedAt, status, summary);
    try {
      await cleanupOldCrawlLogs(db);
    } catch {
      // Best-effort cleanup. Do not fail the crawl result if cleanup fails.
    }
  }

  return {
    startedAt,
    finishedAt,
    summary,
    results,
    runId,
    status
  };
}

// Backward-compatible helper (existing callers)
export async function crawlAllSources(db: DbLike): Promise<CrawlResult[]> {
  const report = await runCrawlJob(db, { triggerType: "manual", triggerRef: "crawlAllSources" });
  return report.results;
}

export function getSourceCatalog() {
  return SOURCES;
}
