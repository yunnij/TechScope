import { crawlAllSources } from "../../../shared/crawler";

interface Env {
  DB: D1Database;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

async function runCrawl(env: Env) {
  const startedAt = new Date().toISOString();
  const results = await crawlAllSources(env.DB);
  const summary = results.reduce(
    (acc, row) => {
      acc.fetched += row.fetched;
      acc.upserted += row.upserted;
      acc.skipped += row.skipped;
      if (row.error) acc.errors += 1;
      return acc;
    },
    { fetched: 0, upserted: 0, skipped: 0, errors: 0 }
  );
  return { startedAt, finishedAt: new Date().toISOString(), summary, results };
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runCrawl(env));
  },

  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname === "/run") {
      const result = await runCrawl(env);
      return json({ ok: true, ...result });
    }
    if (url.pathname === "/health") {
      return json({ ok: true, now: new Date().toISOString() });
    }
    return json({
      ok: true,
      message: "TechScope crawler worker",
      endpoints: ["/run", "/health"]
    });
  }
};
