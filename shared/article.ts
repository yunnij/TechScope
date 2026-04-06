const DEFAULT_FETCH_TIMEOUT_MS = 12000;
const DEFAULT_PAGE_HEADERS: Record<string, string> = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 TechScopeBot/0.4",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "cache-control": "no-cache"
};

export interface ArticleDigestContext {
  title: string | null;
  description: string | null;
  summary: string | null;
  whyItMatters: string | null;
  howItWorks: string | null;
  highlights: string[];
}

function decodeHtml(value: string): string {
  return value
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\u00a0/g, " ");
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripHtmlWithBreaks(value: string): string {
  return normalizeWhitespace(
    decodeHtml(
      value
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(p|div|section|article|li|ul|ol|h1|h2|h3|h4|blockquote)>/gi, "\n")
        .replace(/<li\b[^>]*>/gi, "\n- ")
        .replace(/<[^>]*>/g, " ")
    )
  );
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1).trim()}…`;
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function fetchTextWithTimeout(url: string, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, {
    headers: DEFAULT_PAGE_HEADERS,
    signal: controller.signal
  }).finally(() => clearTimeout(timer));
}

function extractMeta(html: string, names: string[]): string | null {
  for (const name of names) {
    const patterns = [
      new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${name}["']`, "i"),
      new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, "i")
    ];
    for (const pattern of patterns) {
      const raw = html.match(pattern)?.[1]?.trim();
      if (raw) return normalizeWhitespace(decodeHtml(raw));
    }
  }
  return null;
}

function extractTitle(html: string): string | null {
  const og = extractMeta(html, ["og:title", "twitter:title"]);
  if (og) return og;
  const raw = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
  return raw ? normalizeWhitespace(decodeHtml(raw)) : null;
}

function pickBestContainer(html: string): string {
  const patterns = [
    /<article\b[\s\S]*?<\/article>/gi,
    /<main\b[\s\S]*?<\/main>/gi,
    /<(div|section)\b[^>]*(class|id)=["'][^"']*(article|content|post|entry|body|main|markdown)[^"']*["'][\s\S]*?<\/\1>/gi
  ];

  const candidates: string[] = [];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      if (match[0]) candidates.push(match[0]);
    }
  }

  if (candidates.length === 0) return html;

  candidates.sort((a, b) => stripHtmlWithBreaks(b).length - stripHtmlWithBreaks(a).length);
  return candidates[0];
}

function extractLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .map((line) => line.replace(/\s+/g, " "))
    .filter(Boolean)
    .filter((line) => line.length >= 20)
    .filter((line) => !/^(share|copy link|skip to main content|open menu)$/i.test(line));
}

function scoreLine(line: string, keywords: string[]): number {
  const lower = line.toLowerCase();
  let score = Math.min(line.length, 220) / 80;
  for (const keyword of keywords) {
    if (lower.includes(keyword)) score += 4;
  }
  if (/[0-9]/.test(line)) score += 0.6;
  if (line.length > 260) score -= 1.2;
  return score;
}

function chooseBestLine(lines: string[], keywords: string[]): string | null {
  if (lines.length === 0) return null;
  const sorted = [...lines].sort((a, b) => scoreLine(b, keywords) - scoreLine(a, keywords));
  return sorted[0] ? truncate(sorted[0], 220) : null;
}

function chooseHighlights(lines: string[], preferred: string[]): string[] {
  const scored = lines
    .map((line) => ({ line, score: scoreLine(line, preferred) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => truncate(entry.line, 180));

  return unique(scored).slice(0, 3);
}

function extractSectionText(containerHtml: string, headings: string[]): string | null {
  const headingPattern = headings.map((heading) => heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  if (!headingPattern) return null;

  const match = containerHtml.match(
    new RegExp(
      `<h[1-4][^>]*>\\s*(?:${headingPattern})\\s*<\\/h[1-4]>([\\s\\S]*?)(?=<h[1-4][^>]*>|$)`,
      "i"
    )
  );

  if (!match?.[1]) return null;
  const text = stripHtmlWithBreaks(match[1]);
  return text.length >= 30 ? text : null;
}

export async function fetchArticleDigestContext(
  url: string,
  fallback: { title: string; summary: string | null; company: string }
): Promise<ArticleDigestContext> {
  try {
    const res = await fetchTextWithTimeout(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    const container = pickBestContainer(html);
    const lines = extractLines(stripHtmlWithBreaks(container));
    const description = extractMeta(html, ["description", "og:description", "twitter:description"]);

    const tldrSection = extractSectionText(container, ["TL;DR", "tl;dr", "요약"]);
    const tldrLines = tldrSection ? extractLines(tldrSection) : [];

    const summary =
      chooseBestLine(tldrLines, ["tldr", "핵심", "요약"]) ||
      chooseBestLine(lines, ["핵심", "요약", "결론", "성과", "달성", "introducing", "overview"]);

    const whyItMatters = chooseBestLine(lines, [
      "왜",
      "이유",
      "배경",
      "문제",
      "목표",
      "필요",
      "latency",
      "privacy",
      "offline",
      "ux"
    ]);

    const howItWorks = chooseBestLine(lines, [
      "어떻게",
      "방법",
      "전략",
      "구현",
      "모델",
      "지식 증류",
      "distillation",
      "embedding",
      "pipeline",
      "architecture"
    ]);

    const highlights = chooseHighlights(
      [...tldrLines, ...lines],
      ["지표", "성과", "지원", "속도", "모델", "언어", "Recall", "ms", "MB", "온디바이스"]
    );

    return {
      title: extractTitle(html) || fallback.title,
      description: description ? truncate(description, 220) : null,
      summary: summary || fallback.summary,
      whyItMatters,
      howItWorks,
      highlights
    };
  } catch {
    return {
      title: fallback.title,
      description: null,
      summary: fallback.summary,
      whyItMatters: null,
      howItWorks: null,
      highlights: fallback.summary ? [truncate(fallback.summary, 180)] : []
    };
  }
}
