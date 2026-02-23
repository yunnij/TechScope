export type Topic =
  | "frontend"
  | "backend"
  | "mobile"
  | "data"
  | "ai"
  | "infra"
  | "devops"
  | "security"
  | "qa"
  | "product"
  | "other";

export interface SourceConfig {
  id: string;
  company: string;
  homepageUrl: string;
  feedUrl?: string;
  enabled: boolean;
  note?: string;
}

export interface ParsedFeedItem {
  title: string;
  url: string;
  publishedAt: string | null;
  categories: string[];
  summary: string | null;
}

export interface PostRecord {
  sourceId: string;
  company: string;
  title: string;
  url: string;
  publishedAt: string | null;
  primaryTopic: Topic;
  topics: Topic[];
  summary: string | null;
  fetchedAt: string;
}

export interface CrawlResult {
  sourceId: string;
  company: string;
  fetched: number;
  upserted: number;
  skipped: number;
  error?: string;
}
