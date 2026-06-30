/**
 * 生成客户端主键。
 * 时间戳 base36 + 随机串，不依赖 crypto，兼容 RN。
 */
export function genId(prefix = ''): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}${ts}${rand}`;
}
