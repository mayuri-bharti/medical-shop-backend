import express from 'express'
import { verifyAdminToken } from '../../middleware/adminAuth.js'
import User from '../../../models/User.js'

const router = express.Router()

/**
 * GET /admin/users
 * Get all users (admin only)
 * Status codes: 200 (success), 403 (not admin), 500 (error)
 */
router.get('/', verifyAdminToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 50
    const skip = (page - 1) * limit

    const filter = {}
    
    // Search filter
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i')
      filter.$or = [
        { phone: searchRegex },
        { email: searchRegex },
        { name: searchRegex }
      ]
    }
    
    // Role filter
    if (req.query.role) {
      filter.role = req.query.role
    }

    const users = await User.find(filter)
      .select('-password -__v')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

    const total = await User.countDocuments(filter)

    res.json({
      success: true,
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Get admin users error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    })
  }
})

export default router



