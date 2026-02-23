import type { SourceConfig } from "./types";

// NOTE: 일부 feedUrl은 배포 전 실제 경로를 검증하세요.
export const SOURCES: SourceConfig[] = [
  { id: "kakao", company: "Kakao", homepageUrl: "https://tech.kakao.com", feedUrl: "https://tech.kakao.com/feed/", enabled: true },
  { id: "coupang", company: "쿠팡", homepageUrl: "https://medium.com/coupang-engineering", feedUrl: "https://medium.com/feed/coupang-engineering", enabled: true },
  { id: "kurly", company: "마켓컬리", homepageUrl: "https://helloworld.kurly.com", feedUrl: "https://helloworld.kurly.com/feed.xml", enabled: true, note: "피드 URL 검증 필요" },
  { id: "bucketplace", company: "오늘의집", homepageUrl: "https://www.bucketplace.com/post/tech", enabled: false, note: "공개 RSS 확인 후 feedUrl 추가" },
  { id: "woowahan", company: "우아한형제들", homepageUrl: "https://techblog.woowahan.com", feedUrl: "https://techblog.woowahan.com/feed/", enabled: true },
  { id: "banksalad", company: "뱅크샐러드", homepageUrl: "https://blog.banksalad.com/tech", enabled: false, note: "공개 RSS 확인 후 feedUrl 추가" },
  { id: "nhn", company: "NHN", homepageUrl: "https://meetup.nhncloud.com", enabled: false, note: "서비스별 기술블로그 RSS 분리 가능" },
  { id: "daangn", company: "당근", homepageUrl: "https://medium.com/daangn", feedUrl: "https://medium.com/feed/daangn", enabled: true },
  { id: "gangnamunni", company: "강남언니", homepageUrl: "https://blog.gangnamunni.com", enabled: false, note: "공개 RSS 확인 후 feedUrl 추가" },
  { id: "naver-d2", company: "Naver", homepageUrl: "https://d2.naver.com", feedUrl: "https://d2.naver.com/d2.atom", enabled: true },
  { id: "line", company: "Line", homepageUrl: "https://techblog.lycorp.co.jp/ko", enabled: false, note: "LY Corp Tech Blog RSS 경로 확인 필요" },
  { id: "socar", company: "쏘카", homepageUrl: "https://tech.socarcorp.kr", enabled: false, note: "공개 RSS 확인 후 feedUrl 추가" },
  { id: "ridi", company: "리디", homepageUrl: "https://ridicorp.com/story-category/tech", enabled: false, note: "워드프레스 기반 feed 경로 확인 필요" }
];

export const ENABLED_SOURCES = SOURCES.filter((source) => source.enabled && source.feedUrl);
