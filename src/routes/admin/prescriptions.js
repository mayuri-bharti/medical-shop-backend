import express from 'express'
import { body, validationResult } from 'express-validator'
import { verifyAdminToken } from '../../middleware/adminAuth.js'
import Prescription from '../../../models/Prescription.js'
import Product from '../../../models/Product.js'
import Order from '../../../models/Order.js'

const router = express.Router()

const allowedStatuses = [
  'submitted',
  'in_review',
  'approved',
  'rejected',
  'ordered',
  'fulfilled',
  'delivered',
  'cancelled'
]

const statusAliases = {
  pending: 'submitted',
  verified: 'approved',
  completed: 'fulfilled',
  reviewing: 'in_review',
  review: 'in_review'
}

const normalizeStatus = (status) => {
  if (!status) return null
  const normalized = status.toLowerCase()
  const alias = statusAliases[normalized]
  const candidate = alias || normalized
  const match = allowedStatuses.find(s => s === candidate)
  return match || null
}

const validationErrorResponse = (errors, res) => {
  return res.status(400).json({
    success: false,
    message: 'Validation failed',
    errors: errors.array()
  })
}

router.get('/', verifyAdminToken, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1)
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200)
    const skip = (page - 1) * limit

    const filter = { isActive: true }

    if (req.query.status && req.query.status !== 'all') {
      const normalizedStatus = normalizeStatus(req.query.status)
      if (normalizedStatus) {
        filter.status = normalizedStatus
      }
    }

    const prescriptions = await Prescription.find(filter)
      .populate('user', 'name phone email')
      .populate('processedBy', 'name email')
      .populate('assignedTo', 'name email')
      .populate('order', 'orderNumber status total createdAt deliveryDate source')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-__v')

    const total = await Prescription.countDocuments(filter)

    res.json({
      success: true,
      prescriptions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Get all prescriptions error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch prescriptions'
    })
  }
})

router.get('/:id', verifyAdminToken, async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id)
      .populate('user', 'name phone email')
      .populate('processedBy', 'name email')
      .populate('assignedTo', 'name email')
      .populate('order', 'orderNumber status total createdAt deliveryDate paymentMethod source')

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      })
    }

    res.json({
      success: true,
      prescription
    })
  } catch (error) {
    console.error('Get prescription error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch prescription'
    })
  }
})

router.put('/:id/assign', verifyAdminToken, [
  body('note').optional().isString().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return validationErrorResponse(errors, res)
    }

    const prescription = await Prescription.findById(req.params.id)

    if (!prescription || !prescription.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      })
    }

    await prescription.assignTo(req.admin._id)

    if (req.body.note) {
      prescription.pharmacistNotes = req.body.note
      await prescription.save()
    }

    const refreshed = await Prescription.findById(req.params.id)
      .populate('user', 'name phone email')
      .populate('processedBy', 'name email')
      .populate('assignedTo', 'name email')

    res.json({
      success: true,
      message: 'Prescription assigned successfully',
      prescription: refreshed
    })
  } catch (error) {
    console.error('Assign prescription error:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to assign prescription'
    })
  }
})

router.put('/:id/status', verifyAdminToken, [
  body('status')
    .custom((value) => !!normalizeStatus(value))
    .withMessage('Invalid status'),
  body('note').optional().isString().trim(),
  body('pharmacistNotes').optional().isString().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return validationErrorResponse(errors, res)
    }

    const { status, note, pharmacistNotes } = req.body
    const normalizedStatus = normalizeStatus(status)

    const prescription = await Prescription.findById(req.params.id)

    if (!prescription || !prescription.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      })
    }

    await prescription.recordStatusChange({
      status: normalizedStatus,
      changedBy: req.admin._id,
      note
    })

    if (pharmacistNotes !== undefined) {
      prescription.pharmacistNotes = pharmacistNotes
      await prescription.save()
    }

    const updatedPrescription = await Prescription.findById(req.params.id)
      .populate('user', 'name phone email')
      .populate('processedBy', 'name email')
      .populate('assignedTo', 'name email')
      .populate('order', 'orderNumber status total createdAt deliveryDate paymentMethod source')

    res.json({
      success: true,
      message: 'Prescription status updated successfully',
      prescription: updatedPrescription
    })
  } catch (error) {
    console.error('Update prescription status error:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update prescription status'
    })
  }
})

router.post('/:id/order', verifyAdminToken, [
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.productId').optional().isMongoId().withMessage('Invalid product ID'),
  body('items.*.name').optional().isString().trim(),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('items.*.price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('items.*.image').optional().isURL().withMessage('Image must be a valid URL'),
  body('shippingAddress.name').notEmpty().withMessage('Recipient name is required'),
  body('shippingAddress.phoneNumber').notEmpty().withMessage('Phone number is required'),
  body('shippingAddress.address').notEmpty().withMessage('Address is required'),
  body('shippingAddress.city').notEmpty().withMessage('City is required'),
  body('shippingAddress.state').notEmpty().withMessage('State is required'),
  body('shippingAddress.pincode').notEmpty().withMessage('Pincode is required'),
  body('shippingAddress.landmark').optional().isString().trim(),
  body('deliveryFee').optional().isFloat({ min: 0 }),
  body('taxes').optional().isFloat({ min: 0 }),
  body('paymentMethod').optional().isIn(['cod', 'online', 'wallet']),
  body('notes').optional().isString().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return validationErrorResponse(errors, res)
    }

    const prescription = await Prescription.findById(req.params.id).populate('user')

    if (!prescription || !prescription.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      })
    }

    if (prescription.order) {
      return res.status(400).json({
        success: false,
        message: 'Order already exists for this prescription'
      })
    }

    if (!['approved', 'ordered', 'fulfilled'].includes(prescription.status)) {
      return res.status(400).json({
        success: false,
        message: 'Prescription must be approved before creating an order'
      })
    }

    const {
      items,
      shippingAddress,
      deliveryFee = 0,
      taxes = 0,
      paymentMethod = 'cod',
      notes
    } = req.body

    const normalizedItems = []

    for (const [index, item] of items.entries()) {
      let productDoc = null
      if (item.productId) {
        productDoc = await Product.findById(item.productId)
        if (!productDoc) {
          return res.status(400).json({
            success: false,
            message: `Product not found for item ${index + 1}`
          })
        }
      }

      const quantity = Number(item.quantity)
      if (!Number.isFinite(quantity) || quantity < 1) {
        return res.status(400).json({
          success: false,
          message: `Invalid quantity for item ${index + 1}`
        })
      }

      const price = item.price !== undefined
        ? Number(item.price)
        : (productDoc ? productDoc.price : 0)

      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid price for item ${index + 1}`
        })
      }

      const name = item.name || productDoc?.name
      if (!name) {
        return res.status(400).json({
          success: false,
          message: `Item ${index + 1} must include a name or valid product`
        })
      }

      const image = item.image || productDoc?.images?.[0] || ''

      normalizedItems.push({
        product: productDoc?._id || undefined,
        quantity,
        price,
        name,
        image
      })
    }

    const subtotal = normalizedItems.reduce((total, item) => total + (item.price * item.quantity), 0)
    const orderTotal = subtotal + Number(deliveryFee || 0) + Number(taxes || 0)

    const order = new Order({
      user: prescription.user,
      items: normalizedItems,
      subtotal,
      deliveryFee,
      taxes,
      total: orderTotal,
      shippingAddress,
      paymentMethod,
      notes,
      prescription: prescription._id,
      source: 'prescription',
      status: 'confirmed',
      paymentStatus: paymentMethod === 'cod' ? 'pending' : 'paid'
    })

    await order.save()

    prescription.shippingAddressSnapshot = shippingAddress
    await prescription.recordStatusChange({
      status: 'ordered',
      changedBy: req.admin._id,
      note: 'Order created from prescription'
    })
    prescription.order = order._id
    await prescription.save()

    const populatedOrder = await Order.findById(order._id)
      .populate('user', 'name email phone')

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order: populatedOrder
    })
  } catch (error) {
    console.error('Create order from prescription error:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create order from prescription'
    })
  }
})

router.delete('/:id', verifyAdminToken, async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id)

    if (!prescription) {
      return res.status(404).json({
        success: false,
        message: 'Prescription not found'
      })
    }

    prescription.isActive = false
    await prescription.save()

    res.json({
      success: true,
      message: 'Prescription deleted successfully'
    })
  } catch (error) {
    console.error('Delete prescription error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to delete prescription'
    })
  }
})

export default router
