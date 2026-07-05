/**
 * AI coach unlimited-mode contract.
 * These tests are source-level because the route depends on auth and a live DB.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const coachRoute = readFileSync(
  new URL('../src/routes/coach.js', import.meta.url),
  'utf8',
);
const minimax = readFileSync(
  new URL('../src/services/minimax.js', import.meta.url),
  'utf8',
);
const coachScreen = readFileSync(
  new URL('../../src/app/coach/index.tsx', import.meta.url),
  'utf8',
);
const apiClient = readFileSync(
  new URL('../../src/api/client.ts', import.meta.url),
  'utf8',
);

test('coach backend exposes an unlimited usage contract', () => {
  assert.match(coachRoute, /router\.get\(['"]\/usage['"]/);
  assert.match(coachRoute, /unlimited:\s*true/);
  assert.doesNotMatch(coachRoute, /chat_usage/i);
  assert.doesNotMatch(coachRoute, /\.max\(\s*\d+/);
});

test('coach prompt no longer restricts chat to only weight-loss topics or 100 chars', () => {
  assert.doesNotMatch(minimax, /只能回答/);
  assert.doesNotMatch(minimax, /如果用户问与减脂无关/);
  assert.doesNotMatch(minimax, /100\s*字以内/);
});

test('coach screen does not disable input based on daily remaining count', () => {
  assert.doesNotMatch(coachScreen, /remaining\s*>\s*0/);
  assert.doesNotMatch(coachScreen, /remaining\s*<=\s*0/);
  assert.doesNotMatch(coachScreen, /今日次数已用完/);
  assert.doesNotMatch(coachScreen, /maxLength=\{\d+\}/);
});

test('client accepts both public backend environment variable names', () => {
  assert.match(apiClient, /EXPO_PUBLIC_API_BASE_URL/);
  assert.match(apiClient, /EXPO_PUBLIC_BACKEND_URL/);
});
