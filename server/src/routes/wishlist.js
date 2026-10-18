import { Router } from 'express'
import { verifyToken } from '../middlewares/auth.js'
import { add, list, listPublic } from '../controllers/wishlistController.js'

const router = Router()
router.use(verifyToken)
router.post('/add', add)
router.get('/', list)
router.get('/public', listPublic)
export default router