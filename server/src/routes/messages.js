import { Router } from 'express'
import { verifyToken } from '../middlewares/auth.js'
import { send, list } from '../controllers/messageController.js'

const router = Router()
router.use(verifyToken)
router.post('/', send)
router.get('/', list)
export default router