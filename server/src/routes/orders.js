import { Router } from 'express'
import { verifyToken } from '../middlewares/auth.js'
import { create, list, updateStatus, confirmReceipt, applyAftersale, contactAdmin } from '../controllers/orderController.js'

const router = Router()
router.use(verifyToken)
router.post('/create', create)
router.get('/', list)
router.patch('/:id/status', updateStatus)
router.post('/:id/confirm', confirmReceipt)
router.post('/:id/aftersale', applyAftersale)
router.post('/:id/contact-admin', contactAdmin)
export default router
