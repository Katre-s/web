import { Router } from 'express'
import { verifyToken } from '../middlewares/auth.js'
import { adminOnly } from '../middlewares/admin.js'
import { list, create, remove, move, adminList } from '../controllers/hotspotController.js'

const router = Router()

router.get('/', list)
router.post('/', verifyToken, create)
router.get('/admin/list', adminOnly, adminList)
router.put('/:id/sort', adminOnly, move)
router.delete('/:id', adminOnly, remove)

export default router