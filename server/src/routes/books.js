import { Router } from 'express'
import { listBooks, bookDetail, homeStats } from '../controllers/booksController.js'

const router = Router()
router.get('/', listBooks)
router.get('/home-stats', homeStats)
router.get('/:key', bookDetail)
export default router