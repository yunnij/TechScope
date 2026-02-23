import type { SourceConfig } from "./types";

// NOTE:
// - feedUrl이 확인된 소스만 enabled + feedUrl 조합으로 실제 수집됩니다.
// - URL이 불확실한 소스는 enabled: false + note로 남겨두고, 검증 후 활성화하세요.
export const SOURCES: SourceConfig[] = [
  // KR
  { id: "kakao", company: "Kakao", homepageUrl: "https://tech.kakao.com", feedUrl: "https://tech.kakao.com/feed/", enabled: true },
  { id: "coupang", company: "쿠팡", homepageUrl: "https://medium.com/coupang-engineering", feedUrl: "https://medium.com/feed/coupang-engineering", enabled: true },
  { id: "watcha", company: "왓챠", homepageUrl: "https://medium.com/watcha", feedUrl: "https://medium.com/feed/watcha", enabled: true },
  { id: "kurly", company: "마켓컬리", homepageUrl: "https://helloworld.kurly.com", enabled: false, note: "RSS/Atom 경로 검증 필요" },
  { id: "bucketplace", company: "오늘의집", homepageUrl: "https://www.bucketplace.com/culture/tech", enabled: false, note: "공개 RSS 확인 또는 HTML 크롤러 필요" },
  { id: "woowahan", company: "우아한형제들", homepageUrl: "https://techblog.woowahan.com", feedUrl: "https://techblog.woowahan.com/feed/", enabled: true },
  { id: "banksalad", company: "뱅크샐러드", homepageUrl: "https://blog.banksalad.com/tech", enabled: false, note: "공개 RSS 확인 또는 HTML 크롤러 필요" },
  { id: "nhn", company: "NHN", homepageUrl: "https://meetup.nhncloud.com", enabled: false, note: "서비스별 기술블로그/RSS 분리 확인 필요" },
  { id: "daangn", company: "당근", homepageUrl: "https://medium.com/daangn", feedUrl: "https://medium.com/feed/daangn", enabled: true },
  { id: "gangnamunni", company: "강남언니", homepageUrl: "https://blog.gangnamunni.com", enabled: false, note: "공개 RSS 확인 또는 HTML 크롤러 필요" },
  { id: "naver-d2", company: "Naver", homepageUrl: "https://d2.naver.com", feedUrl: "https://d2.naver.com/d2.atom", enabled: true },
  { id: "line", company: "Line", homepageUrl: "https://techblog.lycorp.co.jp/ko", enabled: false, note: "LY Corp Tech Blog RSS 경로 확인 필요" },
  { id: "socar", company: "쏘카", homepageUrl: "https://tech.socarcorp.kr", enabled: false, note: "공개 RSS 확인 또는 HTML 크롤러 필요" },
  { id: "ridi", company: "리디", homepageUrl: "https://ridicorp.com/story-category/tech-blog", enabled: false, note: "워드프레스 feed 경로 확인 필요" },

  // Global
  { id: "amazon", company: "Amazon", homepageUrl: "https://www.amazon.science/blog", enabled: false, note: "Amazon Science Blog RSS 경로 확인 필요" },
  { id: "apple-ml", company: "Apple", homepageUrl: "https://machinelearning.apple.com", feedUrl: "https://machinelearning.apple.com/rss.xml", enabled: true, note: "Apple ML Research blog 기준" },
  { id: "netflix", company: "Netflix", homepageUrl: "https://netflixtechblog.com", feedUrl: "https://netflixtechblog.com/feed", enabled: true },
  { id: "google-developers", company: "Google Developers", homepageUrl: "https://developers.googleblog.com", enabled: false, note: "Blogger RSS/Atom 경로 확인 필요" },
  { id: "microsoft", company: "Microsoft", homepageUrl: "https://devblogs.microsoft.com", feedUrl: "https://devblogs.microsoft.com/feed/", enabled: true },
  { id: "linkedin", company: "LinkedIn", homepageUrl: "https://engineering.linkedin.com/blog", enabled: false, note: "engineering.linkedin.com RSS 경로 확인 필요" },
  { id: "slack", company: "Slack", homepageUrl: "https://slack.engineering", feedUrl: "https://slack.engineering/feed/", enabled: true },
  { id: "airbnb", company: "Airbnb", homepageUrl: "https://medium.com/airbnb-engineering", feedUrl: "https://medium.com/feed/airbnb-engineering", enabled: true },
  { id: "pinterest", company: "Pinterest", homepageUrl: "https://medium.com/pinterest-engineering", feedUrl: "https://medium.com/feed/pinterest-engineering", enabled: true, note: "Pinterest Engineering Medium publication 기준" },
  { id: "twitter", company: "Twitter/X", homepageUrl: "https://blog.x.com", enabled: false, note: "X Engineering 공식 블로그/RSS 경로 확인 필요" },
  { id: "figma", company: "Figma", homepageUrl: "https://www.figma.com/blog/engineering", enabled: false, note: "Figma engineering blog RSS 경로 확인 필요" },
  { id: "spotify", company: "Spotify", homepageUrl: "https://engineering.atspotify.com", feedUrl: "https://engineering.atspotify.com/feed/", enabled: true }
];

export const ENABLED_SOURCES = SOURCES.filter((source) => source.enabled && source.feedUrl);
