import { Router } from 'express'
import { verifyToken } from '../middlewares/auth.js'
import { upload } from '../utils/upload.js'
import { list, myList, create, remove, replyList, replyCreate, replyRemove } from '../controllers/plazaController.js'

const router = Router()

router.get('/', list)
// 自己的帖子要放在前面，避免以后加 /:id 详情路由时被吃掉
router.get('/my', verifyToken, myList)
router.get('/:id/replies', replyList)
router.post('/', verifyToken, upload.array('images', 6), create)
router.post('/:id/replies', verifyToken, replyCreate)
router.delete('/replies/:id', verifyToken, replyRemove)
router.delete('/:id', verifyToken, remove)

export default router
