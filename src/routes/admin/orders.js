import express from 'express'
import { verifyAdminToken } from '../../middleware/adminAuth.js'
import Order from '../../../models/Order.js'

const router = express.Router()

/**
 * GET /admin/orders
 * Get all orders (admin only)
 * Status codes: 200 (success), 403 (not admin), 500 (error)
 */
router.get('/', verifyAdminToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 50
    const skip = (page - 1) * limit

    const filter = {}
    
    // Status filter
    if (req.query.status) {
      filter.status = req.query.status
    }
    
    // Date range filter
    if (req.query.startDate || req.query.endDate) {
      filter.createdAt = {}
      if (req.query.startDate) {
        filter.createdAt.$gte = new Date(req.query.startDate)
      }
      if (req.query.endDate) {
        filter.createdAt.$lte = new Date(req.query.endDate)
      }
    }

    const orders = await Order.find(filter)
      .populate('user', 'name phone email')
      .populate('items.product', 'name brand images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-__v')

    const total = await Order.countDocuments(filter)

    res.json({
      success: true,
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Get admin orders error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders'
    })
  }
})

export default router



