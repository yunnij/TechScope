import { runCrawlJob } from "../../../shared/crawler";

interface Env {
  DB: D1Database;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

async function runCrawl(env: Env, triggerType: "cron" | "manual", triggerRef: string) {
  return runCrawlJob(env.DB, {
    triggerType,
    triggerRef
  });
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runCrawl(env, "cron", event.cron || "worker-cron"));
  },

  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname === "/run") {
      const result = await runCrawl(env, "manual", "worker:/run");
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
