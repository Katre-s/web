import { Router } from 'express'
import { verifyToken } from '../middlewares/auth.js'
import { myAfterSales, appealAfterSale, sellerList, sellerHandle } from '../controllers/afterSaleController.js'

const router = Router()
router.use(verifyToken)

// 买家：我的售后 / 申诉（一次机会，管理员终审）
router.get('/mine', myAfterSales)
router.post('/:id/appeal', appealAfterSale)

// 卖家：售后处理（个人中心-我的发布-售后处理）
router.get('/seller', sellerList)
router.put('/seller/:id', sellerHandle)

export default router
