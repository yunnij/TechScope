import { runCrawlJob } from "../../../shared/crawler";
import { dispatchDueDiscordDigests } from "../../../shared/discord";

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

async function runDigestDispatch(env: Env) {
  return dispatchDueDiscordDigests(env.DB);
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const now = new Date(event.scheduledTime);
    const tasks: Promise<unknown>[] = [runDigestDispatch(env)];
    if (now.getUTCHours() === 3) {
      tasks.push(runCrawl(env, "cron", event.cron || "worker-cron"));
    }
    ctx.waitUntil(Promise.all(tasks));
  },

  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname === "/run") {
      const result = await runCrawl(env, "manual", "worker:/run");
      return json({ ok: true, ...result });
    }
    if (url.pathname === "/dispatch") {
      const result = await runDigestDispatch(env);
      return json({ ok: true, ...result });
    }
    if (url.pathname === "/health") {
      return json({ ok: true, now: new Date().toISOString() });
    }
    return json({
      ok: true,
      message: "TechScope crawler worker",
      endpoints: ["/run", "/dispatch", "/health"]
    });
  }
};
