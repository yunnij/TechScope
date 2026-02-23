import { ENABLED_SOURCES, SOURCES } from "./sources";
import { parseFeedXml } from "./rss";
import { inferTopics } from "./topics";
import type { CrawlResult, PostRecord } from "./types";

interface DbLike {
  prepare(query: string): {
    bind(...args: unknown[]): {
      run<T = unknown>(): Promise<T>;
    };
  };
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

async function fetchSource(sourceId: string, company: string, feedUrl: string): Promise<PostRecord[]> {
  const res = await fetch(feedUrl, {
    headers: { "user-agent": "TechScopeBot/0.1" }
  });
  if (!res.ok) throw new Error(`Feed fetch failed (${res.status})`);

  const xml = await res.text();
  const items = parseFeedXml(xml);
  const fetchedAt = new Date().toISOString();

  return items.map((item) => {
    const topics = inferTopics(item);
    return {
      sourceId,
      company,
      title: item.title,
      url: item.url,
      publishedAt: item.publishedAt,
      primaryTopic: topics[0],
      topics,
      summary: item.summary,
      fetchedAt
    };
  });
}

export async function crawlAllSources(db: DbLike): Promise<CrawlResult[]> {
  const results: CrawlResult[] = [];
  for (const source of ENABLED_SOURCES) {
    try {
      const posts = await fetchSource(source.id, source.company, source.feedUrl!);
      const seen = new Set<string>();
      let upserted = 0;
      let skipped = 0;
      for (const post of posts) {
        if (!post.url || seen.has(post.url)) {
          skipped += 1;
          continue;
        }
        seen.add(post.url);
        await upsertPost(db, post);
        upserted += 1;
      }
      results.push({ sourceId: source.id, company: source.company, fetched: posts.length, upserted, skipped });
    } catch (error) {
      results.push({
        sourceId: source.id,
        company: source.company,
        fetched: 0,
        upserted: 0,
        skipped: 0,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  return results;
}

export function getSourceCatalog() {
  return SOURCES;
}
