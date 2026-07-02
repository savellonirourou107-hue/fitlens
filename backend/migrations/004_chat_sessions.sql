-- 004_chat_sessions.sql
-- AI 教练聊天：24h 自动清理（v0.6 隐私策略）
-- 不存任何明细食物/体重/身份；只存用户发的消息和教练回复
CREATE TABLE IF NOT EXISTS chat_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_time
  ON chat_messages (user_id, created_at DESC);

-- 每日限速：chat_usage 表
CREATE TABLE IF NOT EXISTS chat_usage (
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  count           INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);