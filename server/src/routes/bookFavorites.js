import { Router } from 'express'
import { verifyToken } from '../middlewares/auth.js'
import { toggle, list, check } from '../controllers/bookFavoriteController.js'

const router = Router()
router.post('/toggle', verifyToken, toggle)
router.get('/', verifyToken, list)
router.get('/check/:bookId', verifyToken, check)
export default router