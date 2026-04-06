import {
  getLocalDateKey,
  getSubscriptionByToken,
  isValidDiscordWebhookUrl,
  isValidTimezone,
  sendDiscordDigestNow
} from "../../shared/discord";

interface Env {
  DB: D1Database;
  GEMINI_API_KEY?: string;
}

interface TestBody {
  webhookUrl?: string;
  timezone?: string;
  manageToken?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

async function parseBody(request: Request): Promise<TestBody> {
  try {
    return (await request.json()) as TestBody;
  } catch {
    return {};
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.DB) {
    return json({ ok: false, error: "D1 binding `DB` is not configured" }, 500);
  }

  const body = await parseBody(request);
  const manageToken = body.manageToken?.trim() || "";
  const existing = manageToken ? await getSubscriptionByToken(env.DB, manageToken) : null;
  const webhookUrl = body.webhookUrl?.trim() || existing?.webhookUrl || "";
  const timezone = body.timezone?.trim() || existing?.timezone || "Asia/Seoul";

  if (!isValidDiscordWebhookUrl(webhookUrl)) {
    return json({ ok: false, error: "A valid Discord webhook URL is required" }, 400);
  }
  if (!isValidTimezone(timezone)) {
    return json({ ok: false, error: "A valid IANA timezone is required" }, 400);
  }

  try {
    const localDate = getLocalDateKey(new Date(), timezone);
    const result = await sendDiscordDigestNow(
      env.DB,
      { webhookUrl, timezone, localDate },
      { geminiApiKey: env.GEMINI_API_KEY }
    );

    return json({
      ok: true,
      sent: true,
      timezone,
      localDate,
      post: {
        id: result.post.id,
        company: result.post.company,
        title: result.post.title,
        url: result.post.url
      }
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      },
      500
    );
  }
};
