/**
 * 隐私字段白名单单测：/friends/:id/today 响应只允许指定字段
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('TODAY_PUBLIC_FIELDS 字段白名单', () => {
  const expected = [
    'userId', 'nickname', 'avatarSeed', 'date',
    'intakeKcal', 'burnedKcal', 'targetKcal', 'updatedAt',
  ];
  const src = readFileSync(
    new URL('../src/routes/friends.js', import.meta.url),
    'utf8'
  );
  for (const f of expected) {
    assert.match(src, new RegExp(`['"\`]${f}['"\`]`), `friends.js 应显式构造字段 ${f}`);
  }
});

test('禁止 SELECT meals/exercises/diaries', () => {
  const src = readFileSync(
    new URL('../src/routes/friends.js', import.meta.url),
    'utf8'
  );
  const sqlBlocks = src.match(/sql`[^`]*`/gs) || [];
  for (const block of sqlBlocks) {
    const m = block.match(/\b(meals|exercises|diaries)\b/i);
    assert.equal(m, null, `friends 路由 SQL 不能引用敏感表 ${m?.[0]}`);
  }
});

test('auth 路由不放 email 进 JWT', () => {
  const src = readFileSync(
    new URL('../src/auth.js', import.meta.url),
    'utf8'
  );
  // 找 jwt.sign 的 payload 对象
  const m = src.match(/jwt\.sign\s*\(\s*\{([\s\S]*?)\}/);
  assert.ok(m, 'auth.js 应有 jwt.sign 调用');
  const payloadStr = m[1];
  assert.match(payloadStr, /sub:/);
  assert.match(payloadStr, /ver:/);
  assert.doesNotMatch(payloadStr, /\bemail:/);
});