import { Router } from 'express'
import { verifyToken } from '../middlewares/auth.js'
import { list, add, batchAdd, remove } from '../controllers/cartController.js'

const router = Router()
router.use(verifyToken)
router.get('/', list)
router.post('/add', add)
router.post('/batch-add', batchAdd)
router.delete('/remove/:productId', remove)
export default router