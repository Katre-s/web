import { Router } from 'express'
import multer from 'multer'
import { verifyToken } from '../middlewares/auth.js'
import { chatWithAgent } from '../services/agentService.js'
import { transcribeAudio, asrReady } from '../services/asrService.js'
import { success, fail } from '../utils/response.js'

const router = Router()
router.use(verifyToken)

router.post('/chat', async (req, res, next) => {
  try {
    const { message, history } = req.body
    if (!message || !String(message).trim()) return fail(res, '请输入内容')
    const result = await chatWithAgent(
      String(message).trim(),
      Array.isArray(history) ? history : [],
      { userId: req.user.id }
    )
    success(res, result)
  } catch (err) {
    next(err)
  }
})

// 内存收音频（通话每句都很短，几百 KB，落盘反而慢）
const asrUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 }
})

// 语音识别：APK / 不支持 Web Speech API 的浏览器走这条路
router.post('/asr', asrUpload.single('file'), async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer?.length) return fail(res, '没有收到音频')

    if (!asrReady()) {
      return res.status(200).json({
        code: 2001,
        message: '语音识别服务未配置，请改用文字输入',
        data: { configured: false }
      })
    }

    const ext = (req.file.originalname || '').match(/\.(webm|wav|mp3|m4a|ogg|opus|aac|amr)$/i)?.[1] || 'webm'
    const text = await transcribeAudio(
      req.file.buffer,
      `speech.${ext}`,
      req.file.mimetype || 'audio/webm'
    )
    success(res, { text, configured: true })
  } catch (err) {
    // 供应商超时/额度不足等：给出可读原因，前端提示用户改用文字
    if (err.code === 'ASR_UNCONFIGURED') {
      return res.status(200).json({ code: 2001, message: err.message, data: { configured: false } })
    }
    console.error('[ASR] 识别失败:', err.response?.data || err.message)
    return res.status(200).json({
      code: 2002,
      message: '语音识别失败，请再说一次或改用文字',
      data: { configured: true }
    })
  }
})

export default router