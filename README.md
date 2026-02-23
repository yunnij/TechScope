# TechScope
TechScope — 국내 IT 기업 기술 블로그를 한눈에 모아보는 대시보드 서비스

## What It Does

- 기업 기술블로그 글 수집 (RSS/Atom 기반)
- 대시보드에서 최신 글 목록 확인
- 기업 / 분야 필터링
- 원문 링크로 바로 이동
- D1 기반 중복 방지 저장 (`url` 기준 upsert)
- Cron Worker로 매일 자동 수집

## Architecture

- Frontend: Cloudflare Pages (`public/`)
- API: Cloudflare Pages Functions (`functions/api/*`)
- DB: Cloudflare D1 (`posts`)
- Batch Crawler: Cloudflare Worker + Cron Trigger (`workers/crawler`)

## Project Structure

```text
.
├─ public/                  # Pages frontend (static)
├─ functions/api/           # Pages Functions API
├─ shared/                  # shared crawler/rss/topic logic
├─ migrations/              # D1 schema migrations
└─ workers/crawler/         # Cron Worker (daily crawler)
```

## Included Endpoints

- `GET /api/posts`
  - Query params: `company`, `topic`, `limit`, `offset`
- `GET /api/health`
- Worker (local/dev)
  - `GET /run` : 수동 크롤링 실행
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

생성 후 출력되는 `database_id`를 아래 파일 2곳에 동일하게 반영하세요.

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

- `http://127.0.0.1:8787/run`

브라우저에 JSON이 뜨는 것이 정상입니다. 이 엔드포인트는 크롤링 실행 결과를 반환합니다.

## Important Local Dev Note

로컬 개발 시 `Pages`와 `Worker`가 서로 다른 Wrangler 실행 컨텍스트를 사용하므로, 로컬 D1 상태가 분리되어 보일 수 있습니다.

- Worker `/run` 에서는 저장 성공처럼 보이는데
- Pages `/api/posts` 에는 바로 안 보일 수 있음

배포 환경에서는 동일한 D1 바인딩을 사용하면 해결됩니다.

## Customization

- 수집 대상 기업 / RSS URL: `shared/sources.ts`
- 분야 분류 규칙: `shared/topics.ts`
- RSS/Atom 파싱 로직: `shared/rss.ts`
- 대시보드 UI: `public/index.html`, `public/app.js`, `public/styles.css`

## Current Status / Notes

- 일부 기업은 RSS URL 미확인으로 `enabled: false` 상태입니다.
- `shared/sources.ts`에서 `feedUrl` 추가 후 `enabled: true`로 변경하면 수집 대상에 포함됩니다.
- RSS가 없는 사이트는 HTML 크롤러 어댑터를 추가하는 방향으로 확장 가능합니다.

## Deployment (Recommended)

- Cloudflare Pages 프로젝트 1개 (frontend + Pages Functions)
- Cloudflare Worker 프로젝트 1개 (cron crawler)
- 동일한 D1 데이터베이스를 `DB` 바인딩으로 연결

## License

개인/팀 프로젝트 용도로 자유롭게 수정해서 사용하세요.
