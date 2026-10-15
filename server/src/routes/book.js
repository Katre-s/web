import { Router } from 'express'
import { verifyToken } from '../middlewares/auth.js'
import { upload } from '../utils/upload.js'
import { isbnLookup, parseList, match } from '../controllers/bookController.js'

const router = Router()
router.post('/isbn-lookup', verifyToken, isbnLookup)
router.post('/parse-list', verifyToken, upload.single('image'), parseList)
router.post('/match', verifyToken, match)
export default router