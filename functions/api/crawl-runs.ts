interface Env {
  DB: D1Database;
}

type CrawlRunRow = {
  id: number;
  trigger_type: string;
  trigger_ref: string | null;
  status: string;
  source_count: number;
  fetched_count: number;
  upserted_count: number;
  skipped_count: number;
  error_count: number;
  started_at: string;
  finished_at: string | null;
  created_at: string;
};

type CrawlRunResultRow = {
  crawl_run_id: number;
  source_id: string;
  company: string;
  fetched_count: number;
  upserted_count: number;
  skipped_count: number;
  status: string;
  error_message: string | null;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=15"
    }
  });
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

  try {
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || "10"), 1), 50);
    const includeResults = url.searchParams.get("includeResults") === "1";

    const runs = await env.DB.prepare(
      `SELECT id, trigger_type, trigger_ref, status, source_count, fetched_count, upserted_count, skipped_count, error_count, started_at, finished_at, created_at
       FROM crawl_runs
       ORDER BY started_at DESC
       LIMIT ?`
    )
      .bind(limit)
      .all<CrawlRunRow>();

    const runRows = runs.results ?? [];
    if (!includeResults || runRows.length === 0) {
      return json({ runs: runRows });
    }

    const ids = runRows.map((r) => r.id);
    const placeholders = ids.map(() => "?").join(", ");
    const details = await env.DB.prepare(
      `SELECT crawl_run_id, source_id, company, fetched_count, upserted_count, skipped_count, status, error_message
       FROM crawl_run_results
       WHERE crawl_run_id IN (${placeholders})
       ORDER BY id ASC`
    )
      .bind(...ids)
      .all<CrawlRunResultRow>();

    const grouped = new Map<number, CrawlRunResultRow[]>();
    for (const row of details.results ?? []) {
      const list = grouped.get(row.crawl_run_id) ?? [];
      list.push(row);
      grouped.set(row.crawl_run_id, list);
    }

    return json({
      runs: runRows.map((run) => ({
        ...run,
        results: grouped.get(run.id) ?? []
      }))
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        hint: "If DB binding exists, run D1 migrations (including migrations/0002_crawl_runs.sql)"
      },
      500
    );
  }
};
