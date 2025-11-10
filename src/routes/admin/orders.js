import express from 'express'
import { body, validationResult } from 'express-validator'
import { verifyAdminToken } from '../../middleware/adminAuth.js'
import Order from '../../../models/Order.js'
import Prescription from '../../../models/Prescription.js'

const router = express.Router()

const orderStatuses = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled'
]

const orderToPrescriptionStatusMap = {
  pending: 'ordered',
  confirmed: 'ordered',
  processing: 'fulfilled',
  shipped: 'fulfilled',
  delivered: 'delivered',
  cancelled: 'cancelled'
}

router.get('/', verifyAdminToken, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1)
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200)
    const skip = (page - 1) * limit

    const filter = {}

    if (req.query.status && req.query.status !== 'all') {
      const status = req.query.status.toLowerCase()
      if (orderStatuses.includes(status)) {
        filter.status = status
      }
    }

    if (req.query.source) {
      filter.source = req.query.source
    }

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
      .populate('prescription', 'status order timeline user')
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

router.patch('/:id/status', verifyAdminToken, [
  body('status').isIn(orderStatuses).withMessage('Invalid order status'),
  body('note').optional().isString().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      })
    }

    const { status, note } = req.body

    const order = await Order.findById(req.params.id)

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      })
    }

    await order.updateStatus(status, { changedBy: req.admin._id, note })

    if (order.prescription) {
      const prescription = await Prescription.findById(order.prescription)
      if (prescription) {
        const prescriptionStatus = orderToPrescriptionStatusMap[status]
        if (prescriptionStatus) {
          await prescription.recordStatusChange({
            status: prescriptionStatus,
            changedBy: req.admin._id,
            note: `Order moved to ${status}`
          })
        }
      }
    }

    const updatedOrder = await Order.findById(order._id)
      .populate('user', 'name phone email')
      .populate('items.product', 'name brand images')
      .populate('prescription', 'status order timeline')

    res.json({
      success: true,
      message: 'Order status updated successfully',
      order: updatedOrder
    })
  } catch (error) {
    console.error('Update order status error:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update order status'
    })
  }
})

export default router
