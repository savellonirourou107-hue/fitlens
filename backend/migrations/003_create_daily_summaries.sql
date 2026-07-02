-- 003_create_daily_summaries.sql
-- 每日聚合（好友可见的唯一明细）
CREATE TABLE IF NOT EXISTS daily_summaries (
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  intake_kcal     REAL NOT NULL DEFAULT 0,
  burned_kcal     REAL NOT NULL DEFAULT 0,
  target_kcal     REAL NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_summaries_user_date
  ON daily_summaries (user_id, date DESC);