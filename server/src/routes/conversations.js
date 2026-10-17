import { Router } from 'express'
import { verifyToken } from '../middlewares/auth.js'
import { startConversation, listConversations, getMessages, sendMessage } from '../controllers/conversationController.js'

const router = Router()
router.use(verifyToken)
router.post('/start', startConversation)
router.get('/', listConversations)
router.get('/:id/messages', getMessages)
router.post('/:id/messages', sendMessage)
export default router