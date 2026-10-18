import { Router } from 'express'
import { verifyToken } from '../middlewares/auth.js'
import { upload } from '../utils/upload.js'
import { isbnLookup, parseList, match, processBookList, scanBook } from '../controllers/bookController.js'

const router = Router()
router.post('/isbn-lookup', verifyToken, isbnLookup)
router.post('/scan-book', verifyToken, upload.single('image'), scanBook)
router.post('/parse-list', verifyToken, upload.single('image'), parseList)
router.post('/match', verifyToken, match)
router.post('/process-booklist', verifyToken, processBookList)
export default router