import { Router } from 'express'
import { verifyToken } from '../middlewares/auth.js'
import { home, track } from '../controllers/recommendController.js'

const router = Router()
router.use(verifyToken)
router.get('/home', home)
router.post('/event', track)

export default router
