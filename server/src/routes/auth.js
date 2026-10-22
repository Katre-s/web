import { Router } from 'express'
import { login, register, sendCode, sendChangeEmailCode, changeEmail, me, sendResetCode, resetPassword, uploadAvatar } from '../controllers/authController.js'
import { verifyToken } from '../middlewares/auth.js'

const router = Router()
router.post('/login', login)
router.post('/register', register)
router.post('/send-code', sendCode)
router.post('/send-reset-code', sendResetCode)
router.post('/reset-password', resetPassword)
router.get('/me', verifyToken, me)
router.post('/send-change-email-code', verifyToken, sendChangeEmailCode)
router.post('/change-email', verifyToken, changeEmail)
router.post('/avatar', verifyToken, uploadAvatar)
export default router