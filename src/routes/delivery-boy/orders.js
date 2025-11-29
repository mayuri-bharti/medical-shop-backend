import express from 'express'
import { body, validationResult } from 'express-validator'
import { verifyDeliveryBoyToken } from '../../middleware/deliveryBoyAuth.js'
import Order from '../../../models/Order.js'

const router = express.Router()

/**
 * GET /delivery-boy/orders
 * Get assigned orders for delivery boy
 */
router.get('/', verifyDeliveryBoyToken, async (req, res) => {
  try {
    const { status } = req.query
    const filter = { deliveryBoy: req.deliveryBoyId }

    if (status && status !== 'all') {
      filter.status = status
    }

    const orders = await Order.find(filter)
      .populate('user', 'name phone email')
      .populate('items.product', 'name brand images')
      .populate('prescription', 'originalName fileUrl status')
      .sort({ createdAt: -1 })
      .select('-__v')

    res.json({
      success: true,
      data: orders
    })
  } catch (error) {
    console.error('Get delivery boy orders error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders'
    })
  }
})

/**
 * GET /delivery-boy/orders/:id
 * Get single order details
 */
router.get('/:id', verifyDeliveryBoyToken, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      deliveryBoy: req.deliveryBoyId
    })
      .populate('user', 'name phone email')
      .populate('items.product', 'name brand images price mrp')
      .populate('prescription', 'originalName fileUrl status')
      .select('-__v')

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or not assigned to you'
      })
    }

    res.json({
      success: true,
      data: order
    })
  } catch (error) {
    console.error('Get order details error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order details'
    })
  }
})

/**
 * PATCH /delivery-boy/orders/:id/status
 * Update order status (delivery boy only)
 */
router.patch('/:id/status', verifyDeliveryBoyToken, [
  body('status').isIn(['processing', 'out for delivery', 'delivered', 'cancelled']).withMessage('Invalid status'),
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

    const order = await Order.findOne({
      _id: req.params.id,
      deliveryBoy: req.deliveryBoyId
    })

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or not assigned to you'
      })
    }

    const { status, note } = req.body

    // Update order status
    await order.updateStatus(status, {
      changedBy: req.deliveryBoyId,
      note: note || `Status updated by delivery boy`
    })

    // Update delivery boy stats
    if (status === 'delivered') {
      req.deliveryBoy.stats.completedDeliveries = (req.deliveryBoy.stats.completedDeliveries || 0) + 1
      req.deliveryBoy.stats.totalDeliveries = (req.deliveryBoy.stats.totalDeliveries || 0) + 1
      await req.deliveryBoy.save()
    } else if (status === 'cancelled') {
      req.deliveryBoy.stats.cancelledDeliveries = (req.deliveryBoy.stats.cancelledDeliveries || 0) + 1
      await req.deliveryBoy.save()
    }

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: order
    })
  } catch (error) {
    console.error('Update order status error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to update order status',
      error: error.message
    })
  }
})

/**
 * PATCH /delivery-boy/orders/:id/location
 * Update delivery boy location
 */
router.patch('/:id/location', verifyDeliveryBoyToken, [
  body('latitude').isFloat().withMessage('Valid latitude required'),
  body('longitude').isFloat().withMessage('Valid longitude required')
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

    const order = await Order.findOne({
      _id: req.params.id,
      deliveryBoy: req.deliveryBoyId
    })

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or not assigned to you'
      })
    }

    // Update delivery boy location
    req.deliveryBoy.currentLocation = {
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      lastUpdated: new Date()
    }
    await req.deliveryBoy.save()

    res.json({
      success: true,
      message: 'Location updated successfully'
    })
  } catch (error) {
    console.error('Update location error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to update location'
    })
  }
})

export default router


