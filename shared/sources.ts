import type { SourceConfig } from "./types";

// Only sources with both `enabled: true` and `feedUrl` are crawled.
// homepageUrl values are preserved; feedUrl values are verified/updated.
export const SOURCES: SourceConfig[] = [
  // KR
  { id: "kakao", company: "Kakao", homepageUrl: "https://tech.kakao.com", feedUrl: "https://tech.kakao.com/feed/", enabled: true },
  { id: "kakaoenterprise", company: "Kakao Enterprise", homepageUrl: "https://tech.kakaoenterprise.com", feedUrl: "https://tech.kakaoenterprise.com/feed", enabled: true },
  { id: "coupang", company: "Coupang", homepageUrl: "https://medium.com/coupang-engineering", feedUrl: "https://medium.com/feed/coupang-engineering", enabled: true },
  { id: "musinsa", company: "MUSINSA", homepageUrl: "https://medium.com/musinsa-tech", feedUrl: "https://medium.com/feed/musinsa-tech", enabled: true },
  { id: "watcha", company: "Watcha", homepageUrl: "https://medium.com/watcha", feedUrl: "https://medium.com/feed/watcha", enabled: true },
  { id: "kurly", company: "Kurly", homepageUrl: "https://helloworld.kurly.com", feedUrl: "https://helloworld.kurly.com/feed.xml", enabled: true },
  { id: "bucketplace", company: "Bucketplace", homepageUrl: "https://www.bucketplace.com/culture/Tech/", enabled: false, note: "RSS not confirmed (HTML crawler may be needed)" },
  { id: "woowahan", company: "Woowahan", homepageUrl: "https://techblog.woowahan.com", feedUrl: "https://techblog.woowahan.com/feed/", enabled: true },
  { id: "banksalad", company: "Banksalad", homepageUrl: "https://blog.banksalad.com/tech", feedUrl: "https://blog.banksalad.com/rss.xml", enabled: true },
  { id: "nhn", company: "NHN", homepageUrl: "https://meetup.nhncloud.com", feedUrl: "https://meetup.nhncloud.com/rss", enabled: true },
  { id: "toss", company: "Toss", homepageUrl: "https://toss.tech", feedUrl: "https://toss.tech/rss.xml", enabled: true },
  { id: "daangn", company: "Daangn", homepageUrl: "https://medium.com/daangn", feedUrl: "https://medium.com/feed/daangn", enabled: true },
  { id: "zigbang", company: "Zigbang", homepageUrl: "https://medium.com/zigbang", feedUrl: "https://medium.com/feed/zigbang", enabled: true },
  { id: "gangnamunni", company: "Gangnamunni", homepageUrl: "https://blog.gangnamunni.com/blog/tech", enabled: false, note: "RSS not confirmed (HTML crawler may be needed)" },
  { id: "naver-d2", company: "Naver", homepageUrl: "https://d2.naver.com", feedUrl: "https://d2.naver.com/d2.atom", enabled: true },
  { id: "devsisters", company: "Devsisters", homepageUrl: "https://tech.devsisters.com", feedUrl: "https://tech.devsisters.com/rss.xml", enabled: true },
  { id: "line", company: "Line", homepageUrl: "https://techblog.lycorp.co.jp/ko", feedUrl: "https://techblog.lycorp.co.jp/ko/feed/index.xml", enabled: true },
  { id: "hyperconnect", company: "Hyperconnect", homepageUrl: "https://hyperconnect.github.io", feedUrl: "https://hyperconnect.github.io/feed.xml", enabled: true },
  { id: "yogiyo", company: "Yogiyo", homepageUrl: "https://techblog.yogiyo.co.kr", feedUrl: "https://techblog.yogiyo.co.kr/feed", enabled: true },
  { id: "socar", company: "Socar", homepageUrl: "https://tech.socarcorp.kr", feedUrl: "https://tech.socarcorp.kr/feed", enabled: true },
  { id: "ridi", company: "RIDI", homepageUrl: "https://ridicorp.com/story-category/tech-blog", feedUrl: "https://www.ridicorp.com/feed", enabled: true, note: "Site-wide RSS (may include non-tech posts)" },

  // Global
  { id: "amazon", company: "Amazon", homepageUrl: "https://www.amazon.science/blog", feedUrl: "https://www.amazon.science/index.rss", enabled: true, maxItems: 100, note: "Large feed; capped to 100 items" },
  { id: "apple-ml", company: "Apple ML", homepageUrl: "https://machinelearning.apple.com", feedUrl: "https://machinelearning.apple.com/rss.xml", enabled: true, note: "Apple ML Research blog" },
  { id: "apple-dev", company: "Apple DEV", homepageUrl: "https://developer.apple.com/", feedUrl: "https://developer.apple.com/news/rss/news.rss", enabled: true, note: "Apple Developer News RSS" },
  { id: "netflix", company: "Netflix", homepageUrl: "https://netflixtechblog.com", feedUrl: "https://netflixtechblog.com/feed", enabled: true },
  { id: "google-developers", company: "Google Developers", homepageUrl: "https://developers.googleblog.com", feedUrl: "https://developers.googleblog.com/feeds/posts/default?alt=rss", enabled: true, resolvePublishedAtFromPage: true, note: "RSS items omit pubDate; enrich publishedAt from article page metadata" },
  { id: "microsoft", company: "Microsoft", homepageUrl: "https://devblogs.microsoft.com", feedUrl: "https://devblogs.microsoft.com/feed/", enabled: true },
  { id: "linkedin", company: "LinkedIn", homepageUrl: "https://www.linkedin.com/blog/engineering", enabled: false, note: "Public RSS not confirmed (tested candidate returned HTML)" },
  { id: "slack", company: "Slack", homepageUrl: "https://slack.engineering", feedUrl: "https://slack.engineering/feed/", enabled: true },
  { id: "airbnb", company: "Airbnb", homepageUrl: "https://medium.com/airbnb-engineering", feedUrl: "https://medium.com/feed/airbnb-engineering", enabled: true },
  { id: "pinterest", company: "Pinterest", homepageUrl: "https://medium.com/pinterest-engineering", feedUrl: "https://medium.com/feed/pinterest-engineering", enabled: true, note: "Pinterest Engineering Medium publication" },
  { id: "twitter", company: "Twitter/X", homepageUrl: "https://blog.x.com/engineering/en_us", enabled: false, note: "Candidate RSS paths returned 403" },
  { id: "figma", company: "Figma", homepageUrl: "https://www.figma.com/blog/engineering", enabled: false, note: "Public RSS not confirmed" },
  { id: "spotify", company: "Spotify", homepageUrl: "https://engineering.atspotify.com", feedUrl: "https://engineering.atspotify.com/feed", enabled: true }
];

export const ENABLED_SOURCES = SOURCES.filter((source) => source.enabled && source.feedUrl);
