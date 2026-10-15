import { Router } from 'express'
import { verifyToken } from '../middlewares/auth.js'
import { create, list, updateStatus } from '../controllers/orderController.js'

const router = Router()
router.use(verifyToken)
router.post('/create', create)
router.get('/', list)
router.patch('/:id/status', updateStatus)
export default router