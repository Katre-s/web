import { Router } from 'express'
import { verifyToken } from '../middlewares/auth.js'
import { chatWithAgent } from '../services/agentService.js'
import { success, fail } from '../utils/response.js'

const router = Router()
router.use(verifyToken)

router.post('/chat', async (req, res, next) => {
  try {
    const { message, history } = req.body
    if (!message || !String(message).trim()) return fail(res, '请输入内容')
    const result = await chatWithAgent(String(message).trim(), Array.isArray(history) ? history : [])
    success(res, result)
  } catch (err) {
    next(err)
  }
})

export default router
