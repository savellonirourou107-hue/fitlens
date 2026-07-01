/**
 * @file minimax.js
 * @summary FitLens 后端 MiniMax 视觉识别服务层。
 *
 * 已实测确认的 API 格式（中国区，2026-06-30）：
 *   - Host: https://api.minimaxi.com （国际区为 https://api.minimax.io）
 *   - 视觉模型: MiniMax-M3（通过 GET /v1/models 确认可用；MiniMax-VL-01 不可用）
 *   - 接口: POST https://api.minimaxi.com/v1/chat/completions
 *   - Headers:
 *       Authorization: Bearer <API_KEY>
 *       Content-Type: application/json
 *   - 视觉请求 body（messages[].content 用多模态数组）:
 *       {
 *         "model": "MiniMax-M3",
 *         "messages": [
 *           { "role": "user", "content": [
 *             { "type": "image_url", "image_url": { "url": "data:image/png;base64,xxx" } },
 *             { "type": "text", "text": "你的提问" }
 *           ]}
 *         ],
 *         "max_tokens": 1500
 *       }
 *   - 图片 url 必须是 data:image/xxx;base64,xxx 或 http(s):// 开头
 *   - 响应: choices[0].message.content 为模型文本回复
 *
 * 运行环境: Node 18+（使用内置 fetch 与 AbortController），无 axios 依赖。
 * 配置通过环境变量读取：
 *   MINIMAX_API_KEY    必填
 *   MINIMAX_API_HOST   可选，默认 https://api.minimaxi.com
 *   MINIMAX_VISION_MODEL 可选，默认 MiniMax-M3
 */

/**
 * 从模型文本回复中解析 JSON。
 * 处理三种情况：
 *   1. 纯 JSON 文本
 *   2. 被 ```json ... ``` 代码块包裹
 *   3. 被前后多余文本包围（提取第一个 { ... } 片段）
 *
 * @param {string} raw - 模型返回的文本
 * @returns {object} 解析后的 JSON 对象
 * @throws {Error} 无法解析时抛错
 */
function parseModelJson(raw) {
  if (!raw || typeof raw !== 'string') {
    throw new Error('模型返回内容为空，无法解析 JSON');
  }

  // 去掉 markdown 代码块 ```json ... ``` 或 ``` ... ```
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let candidate = fenceMatch ? fenceMatch[1] : raw;

  // 去掉首尾空白
  candidate = candidate.trim();

  // 先尝试整体解析
  try {
    return JSON.parse(candidate);
  } catch (_) {
    // 继续尝试提取第一个 {...}
  }

  // 提取第一个完整的 JSON 对象（贪心匹配最外层大括号）
  const objMatch = candidate.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0]);
    } catch (_) {
      // 忽略，下面抛错
    }
  }

  // 兜底：模型可能没返回任何 JSON（例如纯文字描述），视为空结果
  return { items: [] };
}

/**
 * 内部辅助：调用 MiniMax 视觉 chat/completions 接口。
 *
 * @param {string} prompt - 文本提问
 * @param {string} imageBase64 - 图片 base64 数据（不含 data: 前缀）
 * @param {string} mimeType - 图片 MIME，如 image/jpeg、image/png
 * @returns {Promise<string>} 模型文本回复（choices[0].message.content）
 * @throws {Error} 环境变量缺失、HTTP 失败、超时、响应结构异常时抛错
 */
async function callVision(prompt, imageBase64, mimeType) {
  const apiKey = process.env.MINIMAX_API_KEY;
  const apiHost = process.env.MINIMAX_API_HOST || 'https://api.minimaxi.com';
  const model = process.env.MINIMAX_VISION_MODEL || 'MiniMax-M3';

  if (!apiKey) {
    throw new Error('缺少环境变量 MINIMAX_API_KEY');
  }
  if (!imageBase64) {
    throw new Error('缺少图片 base64 数据');
  }
  if (!prompt) {
    throw new Error('缺少 prompt');
  }

  const dataUrl = `data:${mimeType};base64,${imageBase64}`;

  const url = `${apiHost.replace(/\/+$/, '')}/v1/chat/completions`;

  const body = {
    model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: dataUrl } },
          { type: 'text', text: prompt },
        ],
      },
    ],
    max_tokens: 1500,
  };

  // 30 秒超时
  const controller = new AbortController();
  const timeoutMs = 30000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw new Error(`MiniMax 请求超时（${timeoutMs}ms）`);
    }
    throw new Error(`MiniMax 请求失败: ${err && err.message ? err.message : String(err)}`);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch (_) {
      /* 忽略 */
    }
    throw new Error(`MiniMax HTTP ${res.status}: ${detail.slice(0, 500)}`);
  }

  let data;
  try {
    data = await res.json();
  } catch (err) {
    throw new Error(`MiniMax 响应非合法 JSON: ${err && err.message ? err.message : String(err)}`);
  }

  const content =
    data &&
    data.choices &&
    data.choices[0] &&
    data.choices[0].message &&
    data.choices[0].message.content;

  if (typeof content !== 'string') {
    throw new Error(`MiniMax 响应结构异常，缺失 choices[0].message.content: ${JSON.stringify(data).slice(0, 500)}`);
  }

  return content;
}

/**
 * 餐食识别：根据餐食图片估算食物项与营养数据。
 *
 * @param {string} imageBase64 - 图片 base64 数据（不含 data: 前缀）
 * @param {string} [mimeType='image/jpeg'] - 图片 MIME
 * @returns {Promise<{items: Array<{name:string,portionGrams:number,caloriesKcal:number,proteinG:number,carbsG:number,fatG:number}>, modelVersion:string, processingMs:number}>}
 * @throws {Error} 调用或解析失败时抛错
 */
export async function recognizeMeal(imageBase64, mimeType = 'image/jpeg') {
  const model = process.env.MINIMAX_VISION_MODEL || 'MiniMax-M3';

  const prompt =
    '你是一名营养分析师。请识别这张图片中的食物，' +
    '估算每项食物的份量（克）、热量（千卡）以及宏量营养素（蛋白质/碳水/脂肪，克）。' +
    '只返回纯 JSON，不要包含任何 markdown 代码块或额外说明文字。' +
    'JSON 结构如下：\n' +
    '{"items":[{"name":"食物名","portionGrams":数值,"caloriesKcal":数值,"proteinG":数值,"carbsG":数值,"fatG":数值}],"modelVersion":"MiniMax-M3"}\n' +
    '其中数值使用数字类型（不要加引号）。若无法识别某项，省略该项。' +
    '如果图片中没有任何食物（例如风景、人物、截图、纯色图等），返回 {"items":[]} （空数组）。' +
    '最后请给出一段温暖、带 Emoji 符号的专业营养师点评（不超过 60 字），放入 comment 字段。例：这是一顿健康的午餐！蛋白质丰富 🥩🥦';

  const startedAt = Date.now();
  const raw = await callVision(prompt, imageBase64, mimeType);
  const processingMs = Date.now() - startedAt;

  const parsed = parseModelJson(raw);

  // 规范化：确保 items 是数组，且每项字段为合法数值
  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  const items = rawItems
    .filter((it) => it && typeof it.name === 'string' && it.name.trim())
    .map((it) => ({
      name: String(it.name).trim().slice(0, 80),
      portionGrams: numOr(it.portionGrams),
      caloriesKcal: numOr(it.caloriesKcal),
      proteinG: numOr(it.proteinG),
      carbsG: numOr(it.carbsG),
      fatG: numOr(it.fatG),
    }));

  const modelVersion =
    typeof parsed.modelVersion === 'string' && parsed.modelVersion
      ? parsed.modelVersion
      : model;

  const comment =
    typeof parsed.comment === 'string' && parsed.comment.trim()
      ? parsed.comment.trim().slice(0, 200)
      : '';

  return { items, modelVersion, processingMs, comment };
}

/** 把任意值转成非负数字，非法则返回 0 */
function numOr(v) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * 运动截图识别：从 Keep 等运动软件截图中读取运动类型、时长、消耗热量等。
 *
 * @param {string} imageBase64 - 图片 base64 数据（不含 data: 前缀）
 * @param {string} [mimeType='image/jpeg'] - 图片 MIME
 * @returns {Promise<{type:string,durationMin:number,caloriesBurnedKcal:number,source:string,rawText:string,processingMs:number}>}
 * @throws {Error} 调用或解析失败时抛错
 */
export async function recognizeExercise(imageBase64, mimeType = 'image/jpeg') {
  const allowedTypes = ['walking', 'running', 'cycling', 'strength', 'yoga', 'swimming', 'hiit', 'other'];

  const prompt =
    '请从这张运动软件（如 Keep）截图中读取运动数据。' +
    '只返回纯 JSON，不要包含任何 markdown 代码块或额外说明文字。' +
    'JSON 结构如下：\n' +
    '{"type":"walking|running|cycling|strength|yoga|swimming|hiit|other","durationMin":数值,"caloriesBurnedKcal":数值,"source":"keep|其他","rawText":"截图里读到的关键文字"}\n' +
    '其中 type 必须是上述枚举值之一（若无法判断则填 "other"），数值使用数字类型（不要加引号）。' +
    'rawText 填写截图中能读到的关键文字（运动名称、时长、热量、配速等），便于后续校对。';

  const startedAt = Date.now();
  const raw = await callVision(prompt, imageBase64, mimeType);
  const processingMs = Date.now() - startedAt;

  const parsed = parseModelJson(raw);

  const typeRaw = typeof parsed.type === 'string' ? parsed.type.toLowerCase() : '';
  const type = allowedTypes.includes(typeRaw) ? typeRaw : 'other';

  const durationMin =
    typeof parsed.durationMin === 'number'
      ? parsed.durationMin
      : parsed.durationMin != null
        ? Number(parsed.durationMin)
        : 0;
  const caloriesBurnedKcal =
    typeof parsed.caloriesBurnedKcal === 'number'
      ? parsed.caloriesBurnedKcal
      : parsed.caloriesBurnedKcal != null
        ? Number(parsed.caloriesBurnedKcal)
        : 0;

  const source = typeof parsed.source === 'string' && parsed.source ? parsed.source : '';
  const rawText = typeof parsed.rawText === 'string' ? parsed.rawText : '';

  return {
    type,
    durationMin: Number.isFinite(durationMin) ? durationMin : 0,
    caloriesBurnedKcal: Number.isFinite(caloriesBurnedKcal) ? caloriesBurnedKcal : 0,
    source,
    rawText,
    processingMs,
  };
}

export default { recognizeMeal, recognizeExercise };
