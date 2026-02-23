import type { ParsedFeedItem } from "./types";

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function matchTag(block: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = block.match(regex);
  return match ? decodeXml(match[1]) : null;
}

function matchTags(block: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "gi");
  return Array.from(block.matchAll(regex))
    .map((m) => (m[1] ? decodeXml(stripHtml(m[1])) : ""))
    .filter(Boolean);
}

function matchAtomLink(block: string): string | null {
  const linkTags = Array.from(block.matchAll(/<link\b([^>]*)\/?>/gi));
  for (const tag of linkTags) {
    const attrs = tag[1] ?? "";
    const rel = attrs.match(/\brel=["']([^"']+)["']/i)?.[1] ?? "alternate";
    const href = attrs.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (href && (rel === "alternate" || rel === "")) return decodeXml(href);
  }
  return null;
}

function toIso(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseRssItems(xml: string): ParsedFeedItem[] {
  const blocks = Array.from(xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)).map((m) => m[0]);
  return blocks
    .map((block) => ({
      title: stripHtml(matchTag(block, "title") ?? ""),
      url: stripHtml(matchTag(block, "link") ?? ""),
      publishedAt: toIso(matchTag(block, "pubDate") ?? matchTag(block, "dc:date")),
      categories: [...matchTags(block, "category"), ...matchTags(block, "dc:subject")],
      summary: (() => {
        const raw = matchTag(block, "description") ?? matchTag(block, "content:encoded");
        return raw ? stripHtml(raw).slice(0, 400) : null;
      })()
    }))
    .filter((item) => item.title && item.url);
}

function parseAtomEntries(xml: string): ParsedFeedItem[] {
  const blocks = Array.from(xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)).map((m) => m[0]);
  return blocks
    .map((block) => ({
      title: stripHtml(matchTag(block, "title") ?? ""),
      url: stripHtml(matchAtomLink(block) ?? matchTag(block, "id") ?? ""),
      publishedAt: toIso(matchTag(block, "published") ?? matchTag(block, "updated")),
      categories: Array.from(block.matchAll(/<category\b([^>]*)\/?>/gi))
        .map((m) => decodeXml(m[1]?.match(/\bterm=["']([^"']+)["']/i)?.[1] ?? ""))
        .filter(Boolean),
      summary: (() => {
        const raw = matchTag(block, "summary") ?? matchTag(block, "content");
        return raw ? stripHtml(raw).slice(0, 400) : null;
      })()
    }))
    .filter((item) => item.title && item.url);
}

export function parseFeedXml(xml: string): ParsedFeedItem[] {
  if (/<feed[\s>]/i.test(xml)) return parseAtomEntries(xml);
  if (/<rss[\s>]/i.test(xml) || /<channel[\s>]/i.test(xml)) return parseRssItems(xml);
  const rss = parseRssItems(xml);
  return rss.length ? rss : parseAtomEntries(xml);
}
