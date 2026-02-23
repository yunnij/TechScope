import { runCrawlJob } from "../../../shared/crawler";

interface Env {
  DB: D1Database;
  CRAWL_ADMIN_TOKEN?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function isAuthorized(request: Request, env: Env): boolean {
  const expected = env.CRAWL_ADMIN_TOKEN?.trim();
  if (!expected) return true;

  const headerToken = request.headers.get("x-admin-token")?.trim();
  const auth = request.headers.get("authorization")?.trim();
  const bearerToken = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";

  return headerToken === expected || bearerToken === expected;
}

async function handle(request: Request, env: Env): Promise<Response> {
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

  if (!isAuthorized(request, env)) {
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  const url = new URL(request.url);
  const sourceId = url.searchParams.get("sourceId")?.trim() || "";
  const sourceIds = sourceId ? [sourceId] : undefined;

  const report = await runCrawlJob(env.DB, {
    triggerType: "api",
    triggerRef: sourceId ? `pages:/api/admin/crawl?sourceId=${sourceId}` : "pages:/api/admin/crawl",
    sourceIds
  });

  return json({ ok: true, ...report });
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => handle(request, env);
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => handle(request, env);
