import { Router } from 'express'
import { login, register, sendCode, sendChangeEmailCode, changeEmail, me } from '../controllers/authController.js'
import { verifyToken } from '../middlewares/auth.js'

const router = Router()
router.post('/login', login)
router.post('/register', register)
router.post('/send-code', sendCode)
router.get('/me', verifyToken, me)
router.post('/send-change-email-code', verifyToken, sendChangeEmailCode)
router.post('/change-email', verifyToken, changeEmail)
export default router