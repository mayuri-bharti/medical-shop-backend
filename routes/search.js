import express from 'express'
import { query, validationResult } from 'express-validator'
import { searchCombined } from '../src/controllers/searchController.js'

const router = express.Router()

router.get('/', [
  // Accept either 'search' or 'q'
  query('search').optional().isString().trim(),
  query('q').optional().isString().trim(),
  query('limit').optional().isInt({ min: 1, max: 50 })
], async (req, res) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Invalid query parameters',
      errors: errors.array()
    })
  }

  return searchCombined(req, res)
})

export default router

