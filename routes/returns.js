import express from 'express'
import { body, validationResult } from 'express-validator'
import Return from '../models/Return.js'
import Order from '../models/Order.js'
import Product from '../models/Product.js'
import { auth } from '../middleware/auth.js'
import { verifyAdminToken } from '../middleware/adminAuth.js'

const router = express.Router()

const returnStatuses = [
  'pending',
  'approved',
  'rejected',
  'pickup_scheduled',
  'picked_up',
  'refund_processed',
  'completed',
  'cancelled'
]

// User: Create return request
router.post('/', auth, [
  body('orderId').isMongoId().withMessage('Valid order ID is required'),
  body('items').isArray().withMessage('Items array is required'),
  body('items.*.orderItemId').notEmpty().withMessage('Order item ID is required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Valid quantity is required'),
  body('reason').isIn(['defective', 'wrong_item', 'damaged', 'not_as_described', 'expired', 'other']).withMessage('Valid reason is required'),
  body('reasonDescription').trim().isLength({ min: 10, max: 1000 }).withMessage('Reason description must be between 10 and 1000 characters'),
  body('refundMethod').optional().isIn(['original', 'wallet', 'bank_transfer']).withMessage('Valid refund method is required')
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

    const { orderId, items, reason, reasonDescription, refundMethod = 'original', images = [] } = req.body

    // Find order
    const order = await Order.findOne({
      _id: orderId,
      user: req.user._id
    }).populate('items.product')

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      })
    }

    // Check if order is eligible for return (must be delivered)
    if (order.status !== 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'Only delivered orders can be returned'
      })
    }

    // Check if return already exists for this order
    const existingReturn = await Return.findOne({ order: orderId, status: { $nin: ['cancelled', 'rejected'] } })
    if (existingReturn) {
      return res.status(400).json({
        success: false,
        message: 'A return request already exists for this order'
      })
    }

    // Validate items and calculate refund
    const returnItems = []
    let totalRefund = 0

    for (const returnItem of items) {
      const orderItem = order.items.find(item => item._id.toString() === returnItem.orderItemId)
      
      if (!orderItem) {
        return res.status(400).json({
          success: false,
          message: `Order item ${returnItem.orderItemId} not found`
        })
      }

      if (returnItem.quantity > orderItem.quantity) {
        return res.status(400).json({
          success: false,
          message: `Return quantity cannot exceed ordered quantity for ${orderItem.name}`
        })
      }

      const product = await Product.findById(orderItem.product)
      if (!product) {
        return res.status(400).json({
          success: false,
          message: `Product ${orderItem.name} not found`
        })
      }

      returnItems.push({
        orderItem: orderItem._id,
        product: orderItem.product,
        quantity: returnItem.quantity,
        price: orderItem.price,
        name: orderItem.name,
        image: orderItem.image || product.images?.[0] || ''
      })

      totalRefund += orderItem.price * returnItem.quantity
    }

    if (returnItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one item must be returned'
      })
    }

    // Use order's shipping address as pickup address
    const pickupAddress = order.shippingAddress || {}

    // Create return request
    const returnRequest = new Return({
      order: orderId,
      user: req.user._id,
      items: returnItems,
      reason,
      reasonDescription,
      refundAmount: totalRefund,
      refundMethod,
      pickupAddress,
      images: Array.isArray(images) ? images : [],
      status: 'pending'
    })

    await returnRequest.save()

    res.status(201).json({
      success: true,
      message: 'Return request created successfully',
      data: returnRequest
    })
  } catch (error) {
    console.error('Create return error:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create return request'
    })
  }
})

// User: Get my returns
router.get('/my-returns', auth, async (req, res) => {
  try {
    const returns = await Return.find({ user: req.user._id })
      .populate('order', 'orderNumber status createdAt total')
      .populate('items.product', 'name brand images')
      .sort({ createdAt: -1 })

    res.json({
      success: true,
      data: returns
    })
  } catch (error) {
    console.error('Get my returns error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch returns'
    })
  }
})

// User: Get single return
router.get('/:id', auth, async (req, res) => {
  try {
    const returnRequest = await Return.findOne({
      _id: req.params.id,
      user: req.user._id
    })
      .populate('order', 'orderNumber status createdAt total shippingAddress')
      .populate('items.product', 'name brand images')

    if (!returnRequest) {
      return res.status(404).json({
        success: false,
        message: 'Return request not found'
      })
    }

    res.json({
      success: true,
      data: returnRequest
    })
  } catch (error) {
    console.error('Get return error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch return request'
    })
  }
})

// User: Cancel return request
router.post('/:id/cancel', auth, async (req, res) => {
  try {
    const returnRequest = await Return.findOne({
      _id: req.params.id,
      user: req.user._id
    })

    if (!returnRequest) {
      return res.status(404).json({
        success: false,
        message: 'Return request not found'
      })
    }

    if (!['pending', 'approved'].includes(returnRequest.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel return request in current status'
      })
    }

    await returnRequest.updateStatus('cancelled', {
      changedBy: req.user._id,
      changedByModel: 'User',
      note: 'Cancelled by user'
    })

    res.json({
      success: true,
      message: 'Return request cancelled successfully',
      data: returnRequest
    })
  } catch (error) {
    console.error('Cancel return error:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to cancel return request'
    })
  }
})

// Admin: Get all returns
router.get('/admin/all', verifyAdminToken, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1)
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200)
    const skip = (page - 1) * limit

    const filter = {}

    if (req.query.status && req.query.status !== 'all') {
      if (returnStatuses.includes(req.query.status.toLowerCase())) {
        filter.status = req.query.status.toLowerCase()
      }
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

    const returns = await Return.find(filter)
      .populate('user', 'name phone email')
      .populate('order', 'orderNumber status createdAt total')
      .populate('items.product', 'name brand images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

    const total = await Return.countDocuments(filter)

    res.json({
      success: true,
      data: returns,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Get admin returns error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch returns'
    })
  }
})

// Admin: Update return status
router.put('/admin/:id/status', verifyAdminToken, [
  body('status').isIn(returnStatuses).withMessage('Valid status is required'),
  body('note')
    .optional()
    .isString()
    .isLength({ max: 500 })
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

    const { status, note, pickupDate, pickupTimeSlot, trackingNumber, refundTransactionId } = req.body

    const returnRequest = await Return.findById(req.params.id)
      .populate('order')
      .populate('items.product')

    if (!returnRequest) {
      return res.status(404).json({
        success: false,
        message: 'Return request not found'
      })
    }

    // Update status
    await returnRequest.updateStatus(status, {
      changedBy: req.admin?._id,
      changedByModel: 'Admin',
      note
    })

    // Update additional fields based on status
    if (pickupDate) returnRequest.pickupDate = new Date(pickupDate)
    if (pickupTimeSlot) returnRequest.pickupTimeSlot = pickupTimeSlot
    if (trackingNumber) returnRequest.trackingNumber = trackingNumber
    if (refundTransactionId) returnRequest.refundTransactionId = refundTransactionId

    if (status === 'refund_processed' || status === 'completed') {
      returnRequest.refundedAt = new Date()
      
      // Restore product stock
      for (const item of returnRequest.items) {
        const product = await Product.findById(item.product)
        if (product) {
          product.stock += item.quantity
          await product.save()
        }
      }
    }

    if (req.body.adminNotes) {
      returnRequest.adminNotes = req.body.adminNotes
    }

    await returnRequest.save()

    res.json({
      success: true,
      message: 'Return status updated successfully',
      data: returnRequest
    })
  } catch (error) {
    console.error('Update return status error:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update return status'
    })
  }
})

// Admin: Get single return
router.get('/admin/:id', verifyAdminToken, async (req, res) => {
  try {
    const returnRequest = await Return.findById(req.params.id)
      .populate('user', 'name phone email')
      .populate('order', 'orderNumber status createdAt total shippingAddress')
      .populate('items.product', 'name brand images stock')

    if (!returnRequest) {
      return res.status(404).json({
        success: false,
        message: 'Return request not found'
      })
    }

    res.json({
      success: true,
      data: returnRequest
    })
  } catch (error) {
    console.error('Get admin return error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch return request'
    })
  }
})

export default router


