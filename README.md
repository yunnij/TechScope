# TechScope

<p align="center">
  <img src="./public/favicon.svg" alt="TechScope icon" width="72" height="72" />
</p>

## Live URL

- https://techscope-4yl.pages.dev/

주니어 개발자를 위한 기술블로그 레이더입니다.  
여러 IT 기업의 기술블로그 글을 수집하고, 회사/분야/기간 필터로 빠르게 탐색할 수 있는 대시보드 서비스입니다.

## What It Does

- 여러 기업 기술블로그 RSS/Atom 수집
- 대시보드에서 최신 글 목록 확인
- 회사 / 분야 / 기간 필터링
- 글 제목 클릭 시 원문 이동
- 링크 복사 버튼으로 URL 복사
- Cloudflare D1 기반 저장 및 중복 방지(`url` 기준 upsert)
- 수동 크롤링 및 크롤링 실행 이력 확인 API

## Architecture

- Frontend: Cloudflare Pages (`public/`)
- API: Cloudflare Pages Functions (`functions/api/*`)
- DB: Cloudflare D1 (`posts`, `crawl_runs`, `crawl_run_results`)
- Batch: Cloudflare Worker Cron (`workers/crawler`)

## Project Structure

```text
.
├─ public/                  # Dashboard UI (Pages frontend)
├─ functions/api/           # Pages Functions API
├─ shared/                  # Shared crawler / RSS / topic logic
├─ migrations/              # D1 migrations
└─ workers/crawler/         # Cron Worker (daily crawler)
```

## API Endpoints

- `GET /api/posts`
  - Query: `company`, `topic`, `limit`, `offset`
- `GET /api/health`
- `GET|POST /api/admin/crawl`
  - 수동 크롤링 실행
  - Query: `sourceId` (선택, 특정 소스만 실행)
  - 선택 인증: `x-admin-token` 또는 `Authorization: Bearer ...`
- `GET /api/crawl-runs`
  - 최근 크롤링 실행 이력 조회
  - Query: `limit`, `includeResults=1`

## Deployment (Cloudflare)

- Cloudflare Pages: 프론트 + Pages Functions
- Cloudflare D1: 게시글/크롤링 로그 저장
- Cloudflare Worker + Cron Trigger: 일 1회 수집 배치

배포 시 확인할 점

- Pages / Worker 모두 동일한 D1을 `DB` 바인딩으로 연결
- `database_id`는 로컬 `.env` 기반 동기화 스크립트로 관리 (`D1_DATABASE_ID`)
- 필요 시 `CRAWL_ADMIN_TOKEN` 설정 후 `/api/admin/crawl` 보호

## Customization

- 수집 대상 기업 / RSS URL: `shared/sources.ts`
- 분야 분류 규칙: `shared/topics.ts`
- RSS / Atom 파싱: `shared/rss.ts`
- 크롤링 파이프라인: `shared/crawler.ts`
- 대시보드 UI: `public/index.html`, `public/app.js`, `public/styles.css`

## Notes

- 일부 기업은 RSS 미확인 상태라 비활성(`enabled: false`)일 수 있습니다.
- RSS가 없는 사이트는 HTML 크롤러 어댑터 방식으로 확장 가능합니다.
