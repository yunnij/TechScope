import { getSourceCatalog } from "../../shared/crawler";

interface Env {
  DB: D1Database;
}

type PostRow = {
  id: number;
  source_id: string;
  company: string;
  title: string;
  url: string;
  published_at: string | null;
  primary_topic: string;
  topics_json: string;
  summary: string | null;
  fetched_at: string;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60"
    }
  });
}

function parseTopics(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.DB) {
    return json(
      {
        ok: false,
        error: "D1 binding `DB` is not configured",
        hint: "Check wrangler.toml [[d1_databases]] binding = \"DB\" and Pages local/dev bindings"
      },
      500
    );
  }

  const u = new URL(request.url);
  const company = u.searchParams.get("company")?.trim() || "";
  const topic = u.searchParams.get("topic")?.trim() || "";
  const limit = Math.min(Math.max(Number(u.searchParams.get("limit") || "60"), 1), 200);
  const offset = Math.max(Number(u.searchParams.get("offset") || "0"), 0);

  const where: string[] = [];
  const bindings: unknown[] = [];
  if (company) {
    where.push("company = ?");
    bindings.push(company);
  }
  if (topic) {
    where.push("primary_topic = ?");
    bindings.push(topic);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const rows = await env.DB.prepare(`
      SELECT id, source_id, company, title, url, published_at, primary_topic, topics_json, summary, fetched_at
      FROM posts
      ${whereSql}
      ORDER BY COALESCE(published_at, fetched_at) DESC
      LIMIT ? OFFSET ?
    `)
    .bind(...bindings, limit, offset)
    .all<PostRow>();

  const total = await env.DB.prepare(`SELECT COUNT(*) as total FROM posts ${whereSql}`)
    .bind(...bindings)
    .first<{ total: number }>();

  const companies = await env.DB.prepare("SELECT DISTINCT company FROM posts ORDER BY company").all<{ company: string }>();
  const topics = await env.DB.prepare("SELECT DISTINCT primary_topic FROM posts ORDER BY primary_topic").all<{ primary_topic: string }>();

  return json({
    posts: (rows.results ?? []).map((r) => ({
      id: r.id,
      sourceId: r.source_id,
      company: r.company,
      title: r.title,
      url: r.url,
      publishedAt: r.published_at,
      primaryTopic: r.primary_topic,
      topics: parseTopics(r.topics_json),
      summary: r.summary,
      fetchedAt: r.fetched_at
    })),
    pagination: { limit, offset, total: total?.total ?? 0 },
    filters: {
      companies: (companies.results ?? []).map((r) => r.company),
      topics: (topics.results ?? []).map((r) => r.primary_topic)
    },
    sources: getSourceCatalog().map((s) => ({
      id: s.id,
      company: s.company,
      homepageUrl: s.homepageUrl,
      enabled: s.enabled,
      feedReady: Boolean(s.feedUrl),
      note: s.note ?? null
    }))
  });
};
