import { Router } from 'express'
import { verifyToken } from '../middlewares/auth.js'
import { adminOnly } from '../middlewares/admin.js'
import { myList, read, readAll, broadcast, sendToOne } from '../controllers/notificationController.js'

const router = Router()

router.get('/', verifyToken, myList)
router.put('/read-all', verifyToken, readAll)
router.put('/:id/read', verifyToken, read)
router.post('/admin/broadcast', adminOnly, broadcast)
router.post('/admin/send', adminOnly, sendToOne)

export default router