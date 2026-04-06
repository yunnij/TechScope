import type { ArticleDigestContext } from "./article";

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
}

export interface GeminiSummaryResult {
  summary: string;
  whyItMatters?: string;
  howItWorks?: string;
  highlights: string[];
}

function normalizeLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function extractJsonBlock(value: string): string {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  if (fenced) return fenced.trim();
  return value.trim();
}

function parseJsonResult(value: string): GeminiSummaryResult | null {
  try {
    const parsed = JSON.parse(extractJsonBlock(value)) as Partial<GeminiSummaryResult>;
    if (!parsed || typeof parsed.summary !== "string") return null;
    return {
      summary: normalizeLine(parsed.summary),
      whyItMatters: typeof parsed.whyItMatters === "string" ? normalizeLine(parsed.whyItMatters) : undefined,
      howItWorks: typeof parsed.howItWorks === "string" ? normalizeLine(parsed.howItWorks) : undefined,
      highlights: Array.isArray(parsed.highlights)
        ? parsed.highlights.filter((item): item is string => typeof item === "string").map(normalizeLine).filter(Boolean).slice(0, 3)
        : []
    };
  } catch {
    return null;
  }
}

function buildPrompt(input: {
  company: string;
  title: string;
  url: string;
  primaryTopic: string;
  publishedAt: string | null;
  article: ArticleDigestContext;
}): string {
  const article = input.article;
  const rawHighlights = article.highlights.length ? article.highlights.join("\n- ") : "- 없음";

  return [
    "You are summarizing a software engineering blog post for a Discord digest.",
    "Return strict JSON only.",
    "",
    "Required JSON schema:",
    '{"summary":"string","whyItMatters":"string","howItWorks":"string","highlights":["string","string","string"]}',
    "",
    "Rules:",
    "- Write in Korean.",
    "- Be concrete and factual.",
    "- Keep Korean spacing natural and readable.",
    "- Prefer short sentences over dense noun phrases.",
    "- Make the output easy to read in Discord on mobile.",
    "- Do not mention information that is not supported by the provided article context.",
    "- `summary` should be 2-3 short sentences and under 220 characters.",
    "- Split ideas clearly. Avoid semicolon-heavy or list-like prose inside `summary`.",
    "- `whyItMatters` should be 1 short sentence and under 120 characters.",
    "- `howItWorks` should be 1 short sentence and under 120 characters.",
    "- `highlights` must contain exactly 3 short bullet-style strings.",
    "- Each highlight should be under 60 characters.",
    "- Do not repeat the title or company name inside `summary` unless necessary.",
    "- Use plain Korean wording instead of overly formal report style.",
    "",
    `Company: ${input.company}`,
    `Title: ${input.title}`,
    `URL: ${input.url}`,
    `Primary topic: ${input.primaryTopic}`,
    `Published at: ${input.publishedAt ?? "unknown"}`,
    "",
    `Meta description: ${article.description ?? "없음"}`,
    `Extracted summary: ${article.summary ?? "없음"}`,
    `Why it matters candidate: ${article.whyItMatters ?? "없음"}`,
    `How it works candidate: ${article.howItWorks ?? "없음"}`,
    "Extracted highlights:",
    rawHighlights
  ].join("\n");
}

export async function generateGeminiDigestSummary(
  apiKey: string,
  input: {
    company: string;
    title: string;
    url: string;
    primaryTopic: string;
    publishedAt: string | null;
    article: ArticleDigestContext;
  }
): Promise<GeminiSummaryResult> {
  const model = "models/gemini-2.5-flash";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8"
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: buildPrompt(input) }]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 400,
        responseMimeType: "application/json"
      }
    })
  });

  if (!res.ok) {
    throw new Error(`Gemini API HTTP ${res.status}`);
  }

  const data = (await res.json()) as GeminiGenerateResponse;
  if (data.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked prompt: ${data.promptFeedback.blockReason}`);
  }

  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim() || "";
  const parsed = text ? parseJsonResult(text) : null;
  if (!parsed) {
    throw new Error("Gemini returned an unexpected response shape");
  }

  return parsed;
}
