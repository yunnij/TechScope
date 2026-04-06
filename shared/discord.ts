import { fetchArticleDigestContext } from "./article";
import { generateGeminiDigestSummary } from "./gemini";

export interface DiscordSubscription {
  id: number;
  webhookUrl: string;
  timezone: string;
  preferredHour: number;
  manageToken: string;
  active: boolean;
  lastSentAt: string | null;
  lastSentLocalDate: string | null;
  lastStatus: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DigestPost {
  id: number;
  company: string;
  title: string;
  url: string;
  publishedAt: string | null;
  primaryTopic: string;
  summary: string | null;
  fetchedAt: string;
}

export interface DeliveryResult {
  subscriptionId: number;
  webhookUrl: string;
  timezone: string;
  preferredHour: number;
  localDate: string;
  delivered: boolean;
  skipped: boolean;
  reason?: string;
  post?: {
    id: number;
    company: string;
    title: string;
    url: string;
  };
}

export interface DigestRuntimeOptions {
  geminiApiKey?: string;
}

interface DbLike {
  prepare(query: string): {
    bind(...args: unknown[]): {
      all<T = unknown>(): Promise<{ results?: T[] }>;
      first<T = unknown>(): Promise<T | null>;
      run(): Promise<unknown>;
    };
  };
}

interface DiscordSubscriptionRow {
  id: number;
  webhook_url: string;
  timezone: string;
  preferred_hour: number;
  manage_token: string;
  active: number;
  last_sent_at: string | null;
  last_sent_local_date: string | null;
  last_status: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

function toSubscription(row: DiscordSubscriptionRow): DiscordSubscription {
  return {
    id: row.id,
    webhookUrl: row.webhook_url,
    timezone: row.timezone,
    preferredHour: row.preferred_hour,
    manageToken: row.manage_token,
    active: row.active === 1,
    lastSentAt: row.last_sent_at,
    lastSentLocalDate: row.last_sent_local_date,
    lastStatus: row.last_status,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function isValidTimezone(value: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function isValidPreferredHour(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 23;
}

export function isValidDiscordWebhookUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const allowedHost = url.hostname === "discord.com" || url.hostname === "discordapp.com";
    return allowedHost && /^\/api\/webhooks\/[^/]+\/[^/]+$/.test(url.pathname);
  } catch {
    return false;
  }
}

export function createManageToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getFormatterParts(date: Date, timezone: string): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false
  }).formatToParts(date);

  return parts.reduce<Record<string, string>>((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});
}

export function getLocalDateKey(date: Date, timezone: string): string {
  const parts = getFormatterParts(date, timezone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function getLocalHour(date: Date, timezone: string): number {
  return Number(getFormatterParts(date, timezone).hour ?? "0");
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1).trim()}…`;
}

export async function buildDiscordDigestMessage(
  post: DigestPost,
  timezone: string,
  localDate: string,
  options: DigestRuntimeOptions = {}
): Promise<string> {
  const article = await fetchArticleDigestContext(post.url, {
    title: post.title,
    summary: post.summary,
    company: post.company
  });
  const title = article.title || post.title;

  let summary = truncate(
    article.summary?.replace(/\s+/g, " ") ||
      article.description?.replace(/\s+/g, " ") ||
      post.summary?.replace(/\s+/g, " ") ||
      `${post.company} 기술 블로그 글입니다.`,
    260
  );
  let whyItMatters = article.whyItMatters ? truncate(article.whyItMatters.replace(/\s+/g, " "), 220) : null;
  let howItWorks = article.howItWorks ? truncate(article.howItWorks.replace(/\s+/g, " "), 220) : null;
  let extraHighlights = article.highlights.slice(0, 3);

  if (options.geminiApiKey) {
    try {
      const gemini = await generateGeminiDigestSummary(options.geminiApiKey, {
        company: post.company,
        title,
        url: post.url,
        primaryTopic: post.primaryTopic,
        publishedAt: post.publishedAt,
        article
      });
      summary = truncate(gemini.summary, 260);
      whyItMatters = gemini.whyItMatters ? truncate(gemini.whyItMatters, 220) : whyItMatters;
      howItWorks = gemini.howItWorks ? truncate(gemini.howItWorks, 220) : howItWorks;
      extraHighlights = gemini.highlights.length ? gemini.highlights : extraHighlights;
    } catch {
      // Fall back to heuristic article extraction when Gemini is unavailable.
    }
  }

  const highlights = [
    `주제: ${String(post.primaryTopic || "other").toUpperCase()}`,
    `게시일: ${post.publishedAt ? post.publishedAt.slice(0, 10) : "미확인"}`,
    ...extraHighlights
  ]
    .map((line, index) => `${index + 1}. ${line}`)
    .join("\n");

  return [
    `**TechScope 오늘의 랜덤 블로그**`,
    `기준일: ${localDate} (${timezone})`,
    "",
    `**${title}**`,
    `회사: ${post.company}`,
    "",
    `요약: ${summary}`,
    whyItMatters ? `배경: ${whyItMatters}` : null,
    howItWorks ? `접근: ${howItWorks}` : null,
    "",
    `핵심 포인트`,
    highlights,
    "",
    `원문: ${post.url}`
  ]
    .filter(Boolean)
    .join("\n");
}

async function markDeliverySuccess(db: DbLike, subscription: DiscordSubscription, localDate: string): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE discord_subscriptions
       SET last_sent_at = ?, last_sent_local_date = ?, last_status = 'success', last_error = NULL, updated_at = ?
       WHERE id = ?`
    )
    .bind(now, localDate, now, subscription.id)
    .run();
}

async function markDeliveryFailure(db: DbLike, subscription: DiscordSubscription, message: string): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE discord_subscriptions
       SET last_status = 'failed', last_error = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(truncate(message, 400), now, subscription.id)
    .run();
}

export async function getSubscriptionByToken(db: DbLike, manageToken: string): Promise<DiscordSubscription | null> {
  const row = await db
    .prepare(
      `SELECT id, webhook_url, timezone, preferred_hour, manage_token, active, last_sent_at, last_sent_local_date, last_status, last_error, created_at, updated_at
       FROM discord_subscriptions
       WHERE manage_token = ?`
    )
    .bind(manageToken)
    .first<DiscordSubscriptionRow>();

  return row ? toSubscription(row) : null;
}

export async function createOrReplaceSubscription(
  db: DbLike,
  input: { webhookUrl: string; timezone: string; preferredHour: number }
): Promise<{ subscription: DiscordSubscription; created: boolean }> {
  const existing = await db
    .prepare(
      `SELECT id, webhook_url, timezone, preferred_hour, manage_token, active, last_sent_at, last_sent_local_date, last_status, last_error, created_at, updated_at
       FROM discord_subscriptions
       WHERE webhook_url = ?`
    )
    .bind(input.webhookUrl)
    .first<DiscordSubscriptionRow>();

  const now = new Date().toISOString();
  const manageToken = createManageToken();

  if (existing) {
    await db
      .prepare(
        `UPDATE discord_subscriptions
         SET timezone = ?, preferred_hour = ?, manage_token = ?, active = 1, last_status = NULL, last_error = NULL, updated_at = ?
         WHERE id = ?`
      )
      .bind(input.timezone, input.preferredHour, manageToken, now, existing.id)
      .run();

    const updated = await getSubscriptionByToken(db, manageToken);
    if (!updated) throw new Error("Subscription update failed");
    return { subscription: updated, created: false };
  }

  await db
    .prepare(
      `INSERT INTO discord_subscriptions (webhook_url, timezone, preferred_hour, manage_token, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`
    )
    .bind(input.webhookUrl, input.timezone, input.preferredHour, manageToken, now, now)
    .run();

  const created = await getSubscriptionByToken(db, manageToken);
  if (!created) throw new Error("Subscription creation failed");
  return { subscription: created, created: true };
}

export async function deleteSubscriptionByToken(db: DbLike, manageToken: string): Promise<boolean> {
  const existing = await getSubscriptionByToken(db, manageToken);
  if (!existing) return false;

  await db.prepare("DELETE FROM discord_subscriptions WHERE id = ?").bind(existing.id).run();
  return true;
}

export async function listDueSubscriptions(db: DbLike, now = new Date()): Promise<Array<{ subscription: DiscordSubscription; localDate: string }>> {
  const rows = await db
    .prepare(
      `SELECT id, webhook_url, timezone, preferred_hour, manage_token, active, last_sent_at, last_sent_local_date, last_status, last_error, created_at, updated_at
       FROM discord_subscriptions
       WHERE active = 1`
    )
    .bind()
    .all<DiscordSubscriptionRow>();

  const due: Array<{ subscription: DiscordSubscription; localDate: string }> = [];
  for (const row of rows.results ?? []) {
    const subscription = toSubscription(row);
    const localDate = getLocalDateKey(now, subscription.timezone);
    const localHour = getLocalHour(now, subscription.timezone);
    if (localHour !== subscription.preferredHour) continue;
    if (subscription.lastSentLocalDate === localDate) continue;
    due.push({ subscription, localDate });
  }
  return due;
}

async function pickRandomPost(db: DbLike): Promise<DigestPost | null> {
  return db
    .prepare(
      `SELECT id, company, title, url, published_at as publishedAt, primary_topic as primaryTopic, summary, fetched_at as fetchedAt
       FROM posts
       ORDER BY RANDOM()
       LIMIT 1`
    )
    .bind()
    .first<DigestPost>();
}

export async function sendDiscordDigestNow(
  db: DbLike,
  input: { webhookUrl: string; timezone: string; localDate?: string },
  options: DigestRuntimeOptions = {}
): Promise<{ ok: true; post: DigestPost; localDate: string }> {
  const post = await pickRandomPost(db);
  if (!post) {
    throw new Error("No posts available");
  }

  const localDate = input.localDate || getLocalDateKey(new Date(), input.timezone);
  const content = await buildDiscordDigestMessage(post, input.timezone, localDate, options);
  const res = await fetch(input.webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ content })
  });

  if (!res.ok) {
    throw new Error(`Discord webhook responded with HTTP ${res.status}`);
  }

  return { ok: true, post, localDate };
}

export async function dispatchDueDiscordDigests(
  db: DbLike,
  now = new Date(),
  options: DigestRuntimeOptions = {}
): Promise<{ dispatched: number; skipped: number; results: DeliveryResult[] }> {
  const dueSubscriptions = await listDueSubscriptions(db, now);
  const results: DeliveryResult[] = [];
  if (dueSubscriptions.length === 0) {
    return { dispatched: 0, skipped: 0, results };
  }

  for (const entry of dueSubscriptions) {
    const { subscription, localDate } = entry;
    const baseResult: DeliveryResult = {
      subscriptionId: subscription.id,
      webhookUrl: subscription.webhookUrl,
      timezone: subscription.timezone,
      preferredHour: subscription.preferredHour,
      localDate,
      delivered: false,
      skipped: false
    };

    try {
      const delivery = await sendDiscordDigestNow(db, {
        webhookUrl: subscription.webhookUrl,
        timezone: subscription.timezone,
        localDate
      }, options);

      await markDeliverySuccess(db, subscription, localDate);
      results.push({
        ...baseResult,
        delivered: true,
        post: {
          id: delivery.post.id,
          company: delivery.post.company,
          title: delivery.post.title,
          url: delivery.post.url
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await markDeliveryFailure(db, subscription, message);
      results.push({ ...baseResult, skipped: true, reason: message });
    }
  }

  const dispatched = results.filter((row) => row.delivered).length;
  const skipped = results.length - dispatched;
  return { dispatched, skipped, results };
}
