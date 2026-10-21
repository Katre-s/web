import { Router } from 'express'
import { current } from '../controllers/weatherController.js'

const router = Router()

// 公开接口：不含任何用户数据，前端首页未登录也可安全降级调用
router.get('/', current)

export default router
