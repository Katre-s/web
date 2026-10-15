import { Router } from 'express'
import { verifyToken } from '../middlewares/auth.js'
import { upload } from '../utils/upload.js'
import { list, detail, create, update, remove, myProducts } from '../controllers/productController.js'

const router = Router()
router.get('/', list)
router.get('/my', verifyToken, myProducts)
router.get('/:id', detail)
router.post('/', verifyToken, upload.array('images', 6), create)
router.put('/:id', verifyToken, update)
router.delete('/:id', verifyToken, remove)
export default router