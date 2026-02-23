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

async function fetchWithTimeout(url: string, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { "user-agent": "TechScopeBot/0.2" },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchSource(source: SourceConfig): Promise<PostRecord[]> {
  if (!source.feedUrl) return [];

  const res = await fetchWithTimeout(source.feedUrl);
  if (!res.ok) throw new Error(`Feed fetch failed (${res.status})`);

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
        error: error instanceof Error ? error.message : String(error)
      };
      results.push(row);
      if (persistRunLog && runId) await insertCrawlRunResult(db, runId, row);
    }
  }

  const finishedAt = new Date().toISOString();
  const { summary, status } = summarize(results);

  if (persistRunLog && runId) {
    await finalizeCrawlRun(db, runId, finishedAt, status, summary);
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
