/**
 * FitLens 识别路由
 * - POST /recognize/meal   接收图片，调用 MiniMax 视觉模型识别食物
 * - POST /recognize/exercise  接收图片，调用 MiniMax 视觉模型识别运动
 * 所有 AI 返回结果均经 zod schema 校验后再返回给前端。
 */
import { Router } from 'express';
import multer from 'multer';
import { recognizeMeal, recognizeExercise } from '../services/minimax.js';
import { safeParseMeal, safeParseExercise } from '../schemas/index.js';

const router = Router();

// 图片上传：内存存储，单文件最大 8MB，字段名 image
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

/**
 * POST /recognize/meal
 * multipart/form-data，字段 image=图片文件
 */
router.post('/meal', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '缺少图片' });
    }
    const base64Image = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;

    const startedAt = Date.now();
    const raw = await recognizeMeal(base64Image, mimeType);
    const processingMs = Date.now() - startedAt;

    const parsed = safeParseMeal(raw);
    if (!parsed.success) {
      return res.status(422).json({
        success: false,
        error: 'AI 返回结果校验失败',
        details: parsed.error,
      });
    }

    // 非食物图片：items 为空时返回友好提示
    if (parsed.data.items.length === 0) {
      return res.json({
        success: true,
        data: {
          items: [],
          modelVersion: raw?.modelVersion,
          processingMs,
          comment: raw?.comment || '',
          message: '未在图片中识别到食物，请换一张餐食照片',
        },
      });
    }

    return res.json({
      success: true,
      data: {
        items: parsed.data.items,
        modelVersion: raw?.modelVersion,
        processingMs,
        comment: raw?.comment || '',
      },
    });
  } catch (err) {
    console.error('[/recognize/meal] error:', err);
    return res.status(500).json({
      success: false,
      error: '识别失败',
      message: '请稍后再试',
    });
  }
});

/**
 * POST /recognize/exercise
 * multipart/form-data，字段 image=图片文件
 */
router.post('/exercise', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '缺少图片' });
    }
    const base64Image = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;

    const startedAt = Date.now();
    const raw = await recognizeExercise(base64Image, mimeType);
    const processingMs = Date.now() - startedAt;

    const parsed = safeParseExercise(raw);
    if (!parsed.success) {
      return res.status(422).json({
        success: false,
        error: 'AI 返回结果校验失败',
        details: parsed.error,
      });
    }

    return res.json({
      success: true,
      data: {
        ...parsed.data,
        processingMs,
      },
    });
  } catch (err) {
    console.error('[/recognize/exercise] error:', err);
    return res.status(500).json({
      success: false,
      error: '识别失败',
      message: '请稍后再试',
    });
  }
});

export default router;
