import type { ParsedFeedItem, Topic } from "./types";

const TOPIC_RULES: Array<{ topic: Topic; keywords: string[] }> = [
  { topic: "frontend", keywords: ["frontend", "front-end", "react", "vue", "ui", "ux", "웹", "프론트"] },
  { topic: "backend", keywords: ["backend", "back-end", "server", "api", "spring", "node", "서버", "백엔드"] },
  { topic: "mobile", keywords: ["android", "ios", "kotlin", "swift", "flutter", "모바일"] },
  { topic: "data", keywords: ["data", "analytics", "etl", "spark", "hadoop", "warehouse", "데이터"] },
  { topic: "ai", keywords: ["ai", "ml", "llm", "machine learning", "deep learning", "인공지능"] },
  { topic: "infra", keywords: ["infra", "network", "kubernetes", "k8s", "cloud", "aws", "gcp", "인프라"] },
  { topic: "devops", keywords: ["devops", "cicd", "ci/cd", "pipeline", "observability", "sre"] },
  { topic: "security", keywords: ["security", "보안", "auth", "oauth", "암호화"] },
  { topic: "qa", keywords: ["qa", "test", "testing", "e2e", "품질", "테스트"] },
  { topic: "product", keywords: ["product", "pm", "design system", "실험", "ab test"] }
];

export function inferTopics(item: ParsedFeedItem): Topic[] {
  const haystack = [item.title, ...item.categories, item.summary ?? ""].join(" ").toLowerCase();
  const matched = TOPIC_RULES
    .filter((rule) => rule.keywords.some((keyword) => haystack.includes(keyword.toLowerCase())))
    .map((rule) => rule.topic);
  return matched.length ? Array.from(new Set(matched)) : ["other"];
}
