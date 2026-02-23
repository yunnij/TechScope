# TechScope

주니어 개발자를 위해 여러 기업 기술 블로그의 새 글을 한눈에 모아보는 대시보드 서비스입니다.

Cloudflare Pages + Pages Functions + D1 + Cron Worker 구조를 기준으로 구현되어 있습니다.

## Features

- 기업 기술 블로그 글 수집 (RSS / Atom 기반)
- 대시보드에서 최신 글 확인
- 기업 / 분야 필터링
- 원문 링크 바로 이동
- D1 `url` 기준 upsert (중복 저장 방지)
- Cron Worker 기반 일 1회 자동 수집
- 수동 크롤링 API + 크롤링 실행 이력 API

## Architecture

- Frontend: Cloudflare Pages (`public/`)
- API: Cloudflare Pages Functions (`functions/api/*`)
- DB: Cloudflare D1 (`posts`, `crawl_runs`, `crawl_run_results`)
- Batch: Cloudflare Worker Cron (`workers/crawler`)

## Project Structure

```text
.
├─ public/                  # Pages frontend (static)
├─ functions/api/           # Pages Functions API
├─ shared/                  # shared crawler/rss/topic logic
├─ migrations/              # D1 schema migrations
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
  - `CRAWL_ADMIN_TOKEN` 바인딩을 설정하면 토큰이 필요합니다
- `GET /api/crawl-runs`
  - 최근 크롤링 실행 이력 조회
  - Query: `limit`, `includeResults=1`

## Worker Endpoints (dev/test)

- `GET /run` : 수동 크롤링 실행 (Worker dev 서버)
- `GET /health`

## Local Setup

## 1) Install dependencies

```bash
npm install
```

## 2) Login to Cloudflare (if needed)

```bash
npx wrangler login
```

## 3) Create D1 database

```bash
npx wrangler d1 create techscope
```

생성 후 출력되는 `database_id`를 아래 2개 파일에 동일하게 입력하세요.

- `wrangler.toml`
- `workers/crawler/wrangler.toml`

## 4) Apply migrations (local)

```bash
npm run d1:migrate:local
```

## 5) Run Pages (frontend + API)

```bash
npm run dev:pages
```

Wrangler가 출력하는 로컬 URL(예: `http://127.0.0.1:8788`)로 접속합니다.

## 6) Run crawler worker (separate terminal)

```bash
npm run dev:worker
```

수동 테스트:

- Worker 실행 테스트: `http://127.0.0.1:8787/run`
- Pages API 기준 수동 실행(권장): `http://127.0.0.1:8788/api/admin/crawl`

브라우저에 JSON이 보이는 것이 정상입니다. 수집 결과 리포트를 반환합니다.

## Important Local Dev Note

로컬 개발에서는 `Pages`와 `Worker`가 서로 다른 Wrangler 실행 컨텍스트를 사용하므로,
로컬 D1 상태가 분리되어 보일 수 있습니다.

- Worker `/run` 에서는 저장 성공처럼 보이는데
- Pages `/api/posts` 에 바로 안 보일 수 있음

로컬에서 UI와 같은 D1 컨텍스트로 테스트하려면 `Pages`의 `/api/admin/crawl`을 사용하세요.

## Customization

- 수집 대상 기업 / RSS URL: `shared/sources.ts`
- 분야 분류 규칙: `shared/topics.ts`
- RSS / Atom 파싱: `shared/rss.ts`
- 크롤링 파이프라인: `shared/crawler.ts`
- 대시보드 UI: `public/index.html`, `public/app.js`, `public/styles.css`

## Notes

- 일부 기업은 RSS URL 미확인으로 `enabled: false` 상태입니다.
- `shared/sources.ts`에서 `feedUrl` 추가 후 `enabled: true`로 변경하면 수집 대상에 포함됩니다.
- RSS가 없는 사이트는 HTML 크롤러 어댑터를 추가하는 방식으로 확장 가능합니다.

## Recommended Deployment

- Cloudflare Pages 프로젝트 1개 (frontend + Pages Functions)
- Cloudflare Worker 프로젝트 1개 (cron crawler)
- 동일한 D1 데이터베이스를 `DB` 바인딩으로 연결
