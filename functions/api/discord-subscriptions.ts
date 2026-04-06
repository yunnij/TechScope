import {
  createOrReplaceSubscription,
  deleteSubscriptionByToken,
  getSubscriptionByToken,
  isValidDiscordWebhookUrl,
  isValidPreferredHour,
  isValidTimezone
} from "../../shared/discord";

interface Env {
  DB: D1Database;
}

interface SubscriptionBody {
  webhookUrl?: string;
  timezone?: string;
  preferredHour?: number;
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

type StoredSubscription = NonNullable<Awaited<ReturnType<typeof getSubscriptionByToken>>>;

function toPublicSubscription(subscription: StoredSubscription) {
  return {
    id: subscription.id,
    timezone: subscription.timezone,
    preferredHour: subscription.preferredHour,
    active: subscription.active,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
    lastSentAt: subscription.lastSentAt,
    lastSentLocalDate: subscription.lastSentLocalDate,
    lastStatus: subscription.lastStatus,
    lastError: subscription.lastError,
    webhookPreview: subscription.webhookUrl.replace(/(\/api\/webhooks\/\d+\/).+$/, "$1***")
  };
}

async function parseBody(request: Request): Promise<SubscriptionBody> {
  try {
    return (await request.json()) as SubscriptionBody;
  } catch {
    return {};
  }
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.DB) {
    return json({ ok: false, error: "D1 binding `DB` is not configured" }, 500);
  }

  const token = new URL(request.url).searchParams.get("token")?.trim() || "";
  if (!token) {
    return json({ ok: false, error: "Query parameter `token` is required" }, 400);
  }

  const subscription = await getSubscriptionByToken(env.DB, token);
  if (!subscription) {
    return json({ ok: false, error: "Subscription not found" }, 404);
  }

  return json({ ok: true, subscription: toPublicSubscription(subscription) });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.DB) {
    return json({ ok: false, error: "D1 binding `DB` is not configured" }, 500);
  }

  const body = await parseBody(request);
  const manageToken = body.manageToken?.trim() || "";
  const timezone = body.timezone?.trim() || "Asia/Seoul";
  const preferredHour = Number(body.preferredHour);
  const existing = manageToken ? await getSubscriptionByToken(env.DB, manageToken) : null;
  const webhookUrl = body.webhookUrl?.trim() || existing?.webhookUrl || "";

  if (!isValidDiscordWebhookUrl(webhookUrl)) {
    return json({ ok: false, error: "A valid Discord webhook URL is required" }, 400);
  }
  if (!isValidTimezone(timezone)) {
    return json({ ok: false, error: "A valid IANA timezone is required" }, 400);
  }
  if (!isValidPreferredHour(preferredHour)) {
    return json({ ok: false, error: "preferredHour must be an integer between 0 and 23" }, 400);
  }

  const result = await createOrReplaceSubscription(env.DB, {
    webhookUrl,
    timezone,
    preferredHour
  });

  return json({
    ok: true,
    created: result.created,
    manageToken: result.subscription.manageToken,
    subscription: toPublicSubscription(result.subscription)
  });
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.DB) {
    return json({ ok: false, error: "D1 binding `DB` is not configured" }, 500);
  }

  const token = new URL(request.url).searchParams.get("token")?.trim() || "";
  if (!token) {
    return json({ ok: false, error: "Query parameter `token` is required" }, 400);
  }

  const deleted = await deleteSubscriptionByToken(env.DB, token);
  if (!deleted) {
    return json({ ok: false, error: "Subscription not found" }, 404);
  }

  return json({ ok: true, deleted: true });
};
