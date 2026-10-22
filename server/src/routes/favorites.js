import { Router } from 'express'
import { verifyToken } from '../middlewares/auth.js'
import { toggle, list, check } from '../controllers/favoriteController.js'

const router = Router()
router.use(verifyToken)
router.post('/toggle', toggle)
router.get('/', list)
router.get('/check/:productId', verifyToken, check)
export default router