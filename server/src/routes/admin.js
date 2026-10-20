import { Router } from 'express'
import { adminOnly } from '../middlewares/admin.js'
import { upload } from '../utils/upload.js'
import { stats, users, updateUser, updateUserNo, createBook, deleteProduct, listBoards, deleteBoard, updateBoard, updateBoardCover, listNotifications, deleteNotification, listWishlists, deleteWishlist } from '../controllers/adminController.js'

const router = Router()

router.use(adminOnly)

router.get('/stats', stats)
router.get('/users', users)
router.put('/users/:id', updateUser)
router.patch('/users/:id/user-no', updateUserNo)
router.post('/products', upload.array('images', 6), createBook)
router.delete('/products/:id', deleteProduct)
router.get('/boards', listBoards)
router.delete('/boards/:id', deleteBoard)
router.put('/boards/:id', updateBoard)
router.post('/boards/:id/cover', upload.single('cover'), updateBoardCover)
router.get('/wishlists', listWishlists)
router.delete('/wishlists/:id', deleteWishlist)
router.get('/notifications', listNotifications)
router.delete('/notifications/:id', deleteNotification)

export default router