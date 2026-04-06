CREATE TABLE IF NOT EXISTS discord_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  webhook_url TEXT NOT NULL UNIQUE,
  timezone TEXT NOT NULL DEFAULT 'Asia/Seoul',
  preferred_hour INTEGER NOT NULL,
  manage_token TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  last_sent_at TEXT,
  last_sent_local_date TEXT,
  last_status TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_discord_subscriptions_active ON discord_subscriptions(active);
CREATE INDEX IF NOT EXISTS idx_discord_subscriptions_manage_token ON discord_subscriptions(manage_token);
