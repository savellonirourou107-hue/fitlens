/**
 * Auth 单测：JWT 不放 email、token_version 软吊销、bcrypt 校验
 * 不依赖数据库，纯函数式 + mock
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

// 设置环境变量（必须在导入 auth.js 之前）
process.env.JWT_SECRET = 'test-secret-1234567890';

const { signToken, verifyToken } = await import('../src/auth.js');

test('signToken payload 不包含 email', () => {
  const token = signToken('user-uuid-1', 0);
  // 解码 payload（不解验签）
  const payloadB64 = token.split('.')[1];
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  assert.equal(payload.sub, 'user-uuid-1');
  assert.equal(payload.ver, 0);
  assert.equal(payload.email, undefined, 'JWT payload 不应包含 email');
});

test('verifyToken 校验通过', () => {
  const token = signToken('user-uuid-2', 3);
  const payload = verifyToken(token);
  assert.equal(payload.sub, 'user-uuid-2');
  assert.equal(payload.ver, 3);
});

test('篡改 token 校验失败', () => {
  const token = signToken('user-uuid-3', 0);
  const tampered = token.slice(0, -5) + 'XXXXX';
  assert.throws(() => verifyToken(tampered));
});

test('过期 token 校验失败', async () => {
  // 短过期 token
  const jwt = (await import('jsonwebtoken')).default;
  const expired = jwt.sign(
    { sub: 'u', ver: 0, iat: Math.floor(Date.now() / 1000) - 3600 },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: -1 }
  );
  assert.throws(() => verifyToken(expired), /expired/i);
});