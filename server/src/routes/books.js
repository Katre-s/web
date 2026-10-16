import { Router } from 'express'
import { listBooks, bookDetail } from '../controllers/booksController.js'

const router = Router()
router.get('/', listBooks)
router.get('/:key', bookDetail)
export default router