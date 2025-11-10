import express from 'express'
import { query, validationResult } from 'express-validator'
import { searchCombined } from '../src/controllers/searchController.js'

const router = express.Router()

router.get('/', [
  query('search').trim().notEmpty().withMessage('Search term is required')
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

