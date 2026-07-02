-- 002_create_friendships.sql
-- 双向好友关系，规范化字段防重复
DO $$ BEGIN
  CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'rejected', 'blocked');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS friendships (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_low_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_high_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requester_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          friendship_status NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_low_lt_high CHECK (user_low_id < user_high_id),
  CONSTRAINT uniq_pair UNIQUE (user_low_id, user_high_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_addressee_pending
  ON friendships (addressee_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_friendships_user_low
  ON friendships (user_low_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user_high
  ON friendships (user_high_id);