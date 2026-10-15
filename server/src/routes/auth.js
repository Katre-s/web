import { Router } from 'express'
import { login, register, sendCode } from '../controllers/authController.js'

const router = Router()
router.post('/login', login)
router.post('/register', register)
router.post('/send-code', sendCode)
export default router