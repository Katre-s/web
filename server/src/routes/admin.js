import { Router } from 'express'
import { adminOnly } from '../middlewares/admin.js'
import { adminList, adminUpdate, adminRemove } from '../controllers/plazaController.js'
import { upload } from '../utils/upload.js'
import { stats, users, updateUser, updateUserNo, createBook, deleteProduct, listItems, updateItem, listBoards, deleteBoard, updateBoard, updateBoardCover, listNotifications, deleteNotification } from '../controllers/adminController.js'

const router = Router()

router.use(adminOnly)

router.get('/stats', stats)
router.get('/users', users)
router.put('/users/:id', updateUser)
router.patch('/users/:id/user-no', updateUserNo)
router.post('/products', upload.array('images', 6), createBook)
router.delete('/products/:id', deleteProduct)
router.get('/items', listItems)
router.put('/items/:id', updateItem)
router.delete('/items/:id', deleteProduct)
router.get('/boards', listBoards)
router.delete('/boards/:id', deleteBoard)
router.put('/boards/:id', updateBoard)
router.post('/boards/:id/cover', upload.single('cover'), updateBoardCover)
router.get('/plaza', adminList)
router.put('/plaza/:id', adminUpdate)
router.delete('/plaza/:id', adminRemove)
router.get('/notifications', listNotifications)
router.delete('/notifications/:id', deleteNotification)

export default router