CREATE TABLE IF NOT EXISTS crawl_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trigger_type TEXT NOT NULL, -- cron | manual | api
  trigger_ref TEXT,           -- cron schedule / request path / source filter
  status TEXT NOT NULL DEFAULT 'running', -- running | success | partial | failed
  source_count INTEGER NOT NULL DEFAULT 0,
  fetched_count INTEGER NOT NULL DEFAULT 0,
  upserted_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS crawl_run_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  crawl_run_id INTEGER NOT NULL,
  source_id TEXT NOT NULL,
  company TEXT NOT NULL,
  fetched_count INTEGER NOT NULL DEFAULT 0,
  upserted_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'success', -- success | failed
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (crawl_run_id) REFERENCES crawl_runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_crawl_runs_started_at ON crawl_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_crawl_run_results_run_id ON crawl_run_results(crawl_run_id);
CREATE INDEX IF NOT EXISTS idx_crawl_run_results_source_id ON crawl_run_results(source_id);
