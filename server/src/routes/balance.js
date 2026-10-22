import { Router } from 'express'
import { verifyToken } from '../middlewares/auth.js'
import { recharge, logs } from '../controllers/balanceController.js'

const router = Router()
router.use(verifyToken)
router.post('/recharge', recharge)
router.get('/logs', logs)
export default router
