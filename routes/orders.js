import express from 'express'
import multer from 'multer'
import { body, validationResult } from 'express-validator'
import Order from '../models/Order.js'
import Cart from '../models/Cart.js'
import Product from '../models/Product.js'
import { auth } from '../middleware/auth.js'
import { verifyAdminToken } from '../middleware/adminAuth.js'
import { storePrescriptionFile } from '../src/utils/prescriptionStorage.js'

const router = express.Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, JPG, and PDF files are allowed.'))
    }
  }
})

const allowedStatuses = ['Processing', 'Out for Delivery', 'Delivered', 'Cancelled']

const findStatusMatch = (status) => {
  if (!status) return allowedStatuses[0]
  const match = allowedStatuses.find(value => value.toLowerCase() === status.toLowerCase())
  return match || allowedStatuses[0]
}

const parseJSONField = (value, fallback = {}) => {
  if (!value) return fallback
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return fallback
    }
  }
  return value
}

const projectOrder = (orderDoc) => {
  const order = orderDoc.toObject({ virtuals: true })
  order.totalAmount = order.total
  return order
}

router.post('/', auth, upload.single('prescription'), async (req, res) => {
  try {
    // Check if user is blocked - prevent blocked users from placing orders
    if (req.user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been blocked. You cannot place new orders. Please contact support for assistance.'
      })
    }

    const shippingAddress = parseJSONField(req.body.shippingAddress)
    if (!shippingAddress.phoneNumber && shippingAddress.phone) {
      shippingAddress.phoneNumber = shippingAddress.phone
    }

    const paymentMethod = (req.body.paymentMethod || 'COD').toUpperCase()

    const validationErrors = []
    const requiredFields = ['name', 'phoneNumber', 'address', 'city', 'state', 'pincode']
    requiredFields.forEach((field) => {
      const value = String(shippingAddress?.[field] || '').trim()
      if (!value) {
        validationErrors.push({ field, message: `${field} is required` })
      } else {
        shippingAddress[field] = value
      }
    })

    if (!['COD', 'ONLINE', 'WALLET'].includes(paymentMethod)) {
      validationErrors.push({ field: 'paymentMethod', message: 'Invalid payment method' })
    }

    if (!req.file && !req.body.prescriptionUrl) {
      validationErrors.push({ field: 'prescription', message: 'Prescription file is required' })
    }

    if (validationErrors.length) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      })
    }

    let orderItems = []
    const providedItems = parseJSONField(req.body.items, null)

    if (Array.isArray(providedItems) && providedItems.length > 0) {
      orderItems = providedItems.map((item) => ({
        product: item.productId || item.product || undefined,
        quantity: Number(item.quantity) || 1,
        price: Number(item.price) || 0,
        name: item.name || '',
        image: item.image || ''
      }))
    } else {
      const cart = await Cart.findOne({ user: req.user._id }).populate('items.product')
      if (!cart || cart.items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cart is empty'
        })
      }

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

      orderItems = cart.items.map(item => ({
        product: item.product._id,
        quantity: item.quantity,
        price: item.price,
        name: item.product.name,
        image: item.product.images?.[0] || item.product.image || ''
      }))

      cart.clearCart()
      await cart.save()
    }

    let prescriptionFile = null
    if (req.file) {
      try {
        prescriptionFile = await storePrescriptionFile(req.file)
      } catch (error) {
        console.error('Prescription upload error:', error)
        return res.status(500).json({
          success: false,
          message: error.message || 'Failed to upload prescription'
        })
      }
    }

    const calculatedSubtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0)

    const order = new Order({
      user: req.user._id,
      items: orderItems,
      shippingAddress,
      paymentMethod,
      subtotal: Number(req.body.subtotal) || calculatedSubtotal,
      deliveryFee: Number(req.body.deliveryFee) || 0,
      taxes: Number(req.body.taxes) || 0,
      total: Number(req.body.totalAmount || req.body.total) || calculatedSubtotal,
      prescriptionUrl: prescriptionFile?.url || req.body.prescriptionUrl,
      prescriptionPublicId: prescriptionFile?.publicId,
      prescriptionStorage: prescriptionFile?.storage || (req.body.prescriptionUrl ? 'external' : null),
      status: 'processing',
      paymentStatus: 'pending'
    })

    await order.save()

    for (const item of orderItems) {
      if (!item.product) continue
      const product = await Product.findById(item.product)
      if (product) {
        product.reduceStock(item.quantity)
        await product.save()
      }
    }

    await order.populate('items.product')

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: projectOrder(order)
    })
  } catch (error) {
    console.error('Create order error:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create order'
    })
  }
})

router.get('/my-orders', auth, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate('items.product')
      .sort({ createdAt: -1 })

    res.json({
      success: true,
      data: orders.map(projectOrder)
    })
  } catch (error) {
    console.error('Fetch my orders error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders'
    })
  }
})

router.get('/', auth, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate('items.product')
      .sort({ createdAt: -1 })

    res.json({
      success: true,
      data: orders.map(projectOrder)
    })
  } catch (error) {
    console.error('Fetch orders error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders'
    })
  }
})

router.get('/all', verifyAdminToken, async (req, res) => {
  try {
    const orders = await Order.find({})
      .populate('user', 'name phone email')
      .sort({ createdAt: -1 })

    res.json({
      success: true,
      orders: orders.map(projectOrder)
    })
  } catch (error) {
    console.error('Fetch all orders error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders'
    })
  }
})

router.put('/:id/status', verifyAdminToken, [
  body('status').isString().notEmpty()
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

    const formattedStatus = findStatusMatch(req.body.status)
    const order = await Order.findById(req.params.id)

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      })
    }

    await order.updateStatus(formattedStatus, { changedBy: req.admin?._id })

    const updated = await Order.findById(req.params.id)

    res.json({
      success: true,
      message: 'Order status updated',
      order: projectOrder(updated)
    })
  } catch (error) {
    console.error('Update order status error:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update order status'
    })
  }
})

// IMPORTANT: More specific routes must come before generic /:id route
router.get('/:id/tracking', auth, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id
    }).populate('items.product')

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      })
    }

    // Return order with status history for tracking
    res.json({
      success: true,
      data: {
        ...projectOrder(order),
        statusHistory: order.statusHistory || []
      }
    })
  } catch (error) {
    console.error('Fetch order tracking error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order tracking'
    })
  }
})

router.get('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id
    }).populate('items.product')

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      })
    }

    res.json({
      success: true,
      data: projectOrder(order)
    })
  } catch (error) {
    console.error('Fetch order error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order'
    })
  }
})

export default router
