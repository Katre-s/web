import { Router } from 'express'
import { adminOnly } from '../middlewares/admin.js'
import { upload } from '../utils/upload.js'
import { stats, users, updateUser, createBook, deleteProduct } from '../controllers/adminController.js'

const router = Router()

router.use(adminOnly)

router.get('/stats', stats)
router.get('/users', users)
router.put('/users/:id', updateUser)
router.post('/products', upload.array('images', 6), createBook)
router.delete('/products/:id', deleteProduct)

export default router