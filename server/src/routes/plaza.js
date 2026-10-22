import { Router } from 'express'
import { verifyToken } from '../middlewares/auth.js'
import { upload } from '../utils/upload.js'
import { list, create, remove } from '../controllers/plazaController.js'

const router = Router()

router.get('/', list)
router.post('/', verifyToken, upload.array('images', 6), create)
router.delete('/:id', verifyToken, remove)

export default router
