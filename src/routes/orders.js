const express = require('express')
const { body, validationResult } = require('express-validator')
const { auth } = require('../middleware/auth')
const Order = require('../../models/Order')
const Cart = require('../../models/Cart')
const Product = require('../../models/Product')

const router = express.Router()

/**
 * POST /orders
 * Create order from cart
 */
router.post('/', auth, [
  body('shippingAddress.name').notEmpty().withMessage('Name is required'),
  body('shippingAddress.phone').isMobilePhone('en-IN', { strictMode: false }).withMessage('Valid phone number is required'),
  body('shippingAddress.street').notEmpty().withMessage('Street address is required'),
  body('shippingAddress.city').notEmpty().withMessage('City is required'),
  body('shippingAddress.state').notEmpty().withMessage('State is required'),
  body('shippingAddress.pincode').isPostalCode('IN').withMessage('Valid pincode is required'),
  body('paymentMethod').isIn(['COD', 'ONLINE', 'WALLET']).withMessage('Invalid payment method')
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

    const { shippingAddress, paymentMethod } = req.body

    // Get user's cart
    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product')
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty'
      })
    }

    // Validate stock availability
    for (const item of cart.items) {
      const product = await Product.findById(item.product._id)
      if (!product || !product.isActive) {
        return res.status(400).json({
          success: false,
          message: `Product ${item.product.name} is no longer available`
        })
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${item.product.name}`
        })
      }
    }

    // Calculate totals
    cart.calculateTotals()

    // Create order items
    const orderItems = cart.items.map(item => ({
      productId: item.product._id,
      qty: item.quantity,
      price: item.price,
      name: item.product.name,
      sku: item.product.sku || 'N/A'
    }))

    // Create order
    const order = new Order({
      user: req.user._id,
      items: orderItems,
      total: cart.total,
      address: shippingAddress,
      paymentMethod,
      paymentStatus: 'PENDING',
      status: 'PENDING'
    })

    await order.save()

    // Reduce product stock
    for (const item of cart.items) {
      const product = await Product.findById(item.product._id)
      product.reduceStock(item.quantity)
      await product.save()
    }

    // Clear cart
    cart.clearCart()
    await cart.save()

    // For mocked payment, automatically mark as placed
    order.status = 'CONFIRMED'
    order.paymentStatus = 'PAID'
    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        status: 'PLACED',
        total: order.total,
        items: order.items,
        address: order.address,
        paymentMethod: order.paymentMethod
      }
    })

  } catch (error) {
    console.error('Create order error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to create order'
    })
  }
})

/**
 * GET /orders
 * Get user's orders
 */
router.get('/', auth, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 })

    res.json({
      success: true,
      data: orders
    })
  } catch (error) {
    console.error('Get orders error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders'
    })
  }
})

module.exports = router








