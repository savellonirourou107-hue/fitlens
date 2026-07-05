-- 005_remove_chat_usage_limit.sql
-- AI 教练取消每日次数统计表；聊天本身继续使用 chat_messages。
DROP TABLE IF EXISTS chat_usage;
