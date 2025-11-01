const express = require('express')
const { body, validationResult } = require('express-validator')
const Order = require('../models/Order')
const Cart = require('../models/Cart')
const Product = require('../models/Product')
const { auth } = require('../middleware/auth')

const router = express.Router()

// Get user's orders
router.get('/', auth, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate('items.product')
      .sort({ createdAt: -1 })

    res.json(orders)
  } catch (error) {
    console.error('Get orders error:', error)
    res.status(500).json({ message: 'Failed to fetch orders' })
  }
})

// Get single order
router.get('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findOne({ 
      _id: req.params.id, 
      user: req.user._id 
    }).populate('items.product')

    if (!order) {
      return res.status(404).json({ message: 'Order not found' })
    }

    res.json(order)
  } catch (error) {
    console.error('Get order error:', error)
    res.status(500).json({ message: 'Failed to fetch order' })
  }
})

// Create order from cart
router.post('/', auth, [
  body('shippingAddress.name').notEmpty().withMessage('Name is required'),
  body('shippingAddress.phoneNumber').isMobilePhone('en-IN').withMessage('Valid phone number is required'),
  body('shippingAddress.address').notEmpty().withMessage('Address is required'),
  body('shippingAddress.city').notEmpty().withMessage('City is required'),
  body('shippingAddress.state').notEmpty().withMessage('State is required'),
  body('shippingAddress.pincode').isPostalCode('IN').withMessage('Valid pincode is required'),
  body('paymentMethod').isIn(['cod', 'online', 'wallet']).withMessage('Invalid payment method')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array()
      })
    }

    const { shippingAddress, paymentMethod, prescription } = req.body

    // Get user's cart
    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product')
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' })
    }

    // Validate stock availability
    for (const item of cart.items) {
      const product = await Product.findById(item.product._id)
      if (!product || !product.isActive) {
        return res.status(400).json({ 
          message: `Product ${item.product.name} is no longer available` 
        })
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({ 
          message: `Insufficient stock for ${item.product.name}` 
        })
      }
    }

    // Create order items
    const orderItems = cart.items.map(item => ({
      product: item.product._id,
      quantity: item.quantity,
      price: item.price,
      name: item.product.name,
      image: item.product.image
    }))

    // Create order
    const order = new Order({
      user: req.user._id,
      items: orderItems,
      shippingAddress,
      paymentMethod,
      prescription,
      subtotal: cart.subtotal,
      deliveryFee: cart.deliveryFee,
      taxes: cart.taxes,
      total: cart.total
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

    // Populate order for response
    await order.populate('items.product')

    res.status(201).json(order)
  } catch (error) {
    console.error('Create order error:', error)
    res.status(500).json({ message: 'Failed to create order' })
  }
})

// Cancel order
router.patch('/:id/cancel', auth, [
  body('reason').optional().isString()
], async (req, res) => {
  try {
    const { reason } = req.body

    const order = await Order.findOne({ 
      _id: req.params.id, 
      user: req.user._id 
    })

    if (!order) {
      return res.status(404).json({ message: 'Order not found' })
    }

    await order.cancelOrder(reason)

    res.json(order)
  } catch (error) {
    console.error('Cancel order error:', error)
    res.status(500).json({ message: error.message || 'Failed to cancel order' })
  }
})

// Track order
router.get('/:id/track', auth, async (req, res) => {
  try {
    const order = await Order.findOne({ 
      _id: req.params.id, 
      user: req.user._id 
    }).populate('items.product')

    if (!order) {
      return res.status(404).json({ message: 'Order not found' })
    }

    const trackingInfo = {
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: order.createdAt,
      deliveryDate: order.deliveryDate,
      trackingNumber: order.trackingNumber,
      shippingAddress: order.shippingAddress,
      items: order.items
    }

    res.json(trackingInfo)
  } catch (error) {
    console.error('Track order error:', error)
    res.status(500).json({ message: 'Failed to track order' })
  }
})

module.exports = router




