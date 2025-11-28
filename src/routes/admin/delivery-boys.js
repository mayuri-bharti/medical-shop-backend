import express from 'express'
import { body, validationResult } from 'express-validator'
import { verifyAdminToken } from '../../middleware/adminAuth.js'
import DeliveryBoy from '../../../models/DeliveryBoy.js'
import Order from '../../../models/Order.js'

const router = express.Router()

/**
 * GET /admin/delivery-boys
 * Get all delivery boys (admin only)
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
        { name: searchRegex },
        { vehicleNumber: searchRegex }
      ]
    }
    
    // Status filter
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true'
    }

    const deliveryBoys = await DeliveryBoy.find(filter)
      .select('-password -__v')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

    const total = await DeliveryBoy.countDocuments(filter)

    res.json({
      success: true,
      deliveryBoys,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Get delivery boys error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch delivery boys'
    })
  }
})

/**
 * GET /admin/delivery-boys/:id
 * Get single delivery boy (admin only)
 */
router.get('/:id', verifyAdminToken, async (req, res) => {
  try {
    const deliveryBoy = await DeliveryBoy.findById(req.params.id)
      .select('-password -__v')
      .populate('assignedOrders', 'orderNumber status total createdAt')

    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: 'Delivery boy not found'
      })
    }

    res.json({
      success: true,
      deliveryBoy
    })
  } catch (error) {
    console.error('Get delivery boy error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch delivery boy'
    })
  }
})

/**
 * POST /admin/delivery-boys/create
 * Create new delivery boy (admin only)
 */
router.post('/create', verifyAdminToken, [
  body('name').trim().isLength({ min: 2 }).withMessage('Name is required'),
  body('phone').trim().matches(/^[0-9]{10}$/).withMessage('Phone must be 10 digits'),
  body('email').optional().isEmail().normalizeEmail(),
  body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('vehicleNumber').optional().trim(),
  body('vehicleType').optional().isIn(['Bike', 'Scooter', 'Car', 'Cycle', 'Other']),
  body('licenseNumber').optional().trim()
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

    const { name, phone, email, password, vehicleNumber, vehicleType, licenseNumber, address } = req.body

    // Check if delivery boy already exists
    const existing = await DeliveryBoy.findOne({ phone })
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Delivery boy with this phone already exists'
      })
    }

    // Generate password if not provided
    const deliveryBoyPassword = password || Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase() + '123'

    const deliveryBoy = new DeliveryBoy({
      name,
      phone,
      email: email || undefined,
      password: deliveryBoyPassword,
      vehicleNumber: vehicleNumber || undefined,
      vehicleType: vehicleType || 'Bike',
      licenseNumber: licenseNumber || undefined,
      address: address || undefined,
      isActive: true,
      isVerified: true
    })

    await deliveryBoy.save()

    res.status(201).json({
      success: true,
      message: 'Delivery boy created successfully',
      data: {
        deliveryBoy: deliveryBoy.getPublicProfile(),
        password: deliveryBoyPassword
      }
    })
  } catch (error) {
    console.error('Create delivery boy error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to create delivery boy',
      error: error.message
    })
  }
})

/**
 * PUT /admin/delivery-boys/:id
 * Update delivery boy (admin only)
 */
router.put('/:id', verifyAdminToken, [
  body('name').optional().trim().isLength({ min: 2 }),
  body('phone').optional().trim().matches(/^[0-9]{10}$/),
  body('email').optional().isEmail().normalizeEmail(),
  body('password').optional().isLength({ min: 6 }),
  body('vehicleNumber').optional().trim(),
  body('vehicleType').optional().isIn(['Bike', 'Scooter', 'Car', 'Cycle', 'Other']),
  body('licenseNumber').optional().trim()
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

    const { id } = req.params
    const deliveryBoy = await DeliveryBoy.findById(id)

    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: 'Delivery boy not found'
      })
    }

    // Update fields
    const { name, phone, email, password, vehicleNumber, vehicleType, licenseNumber, address, isActive } = req.body

    if (name !== undefined) deliveryBoy.name = name
    if (phone !== undefined) {
      // Check if phone already exists for another delivery boy
      const existing = await DeliveryBoy.findOne({ phone, _id: { $ne: id } })
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'Phone number already exists'
        })
      }
      deliveryBoy.phone = phone
    }
    if (email !== undefined) deliveryBoy.email = email
    if (password !== undefined) deliveryBoy.password = password
    if (vehicleNumber !== undefined) deliveryBoy.vehicleNumber = vehicleNumber
    if (vehicleType !== undefined) deliveryBoy.vehicleType = vehicleType
    if (licenseNumber !== undefined) deliveryBoy.licenseNumber = licenseNumber
    if (address !== undefined) deliveryBoy.address = address
    if (isActive !== undefined) deliveryBoy.isActive = isActive

    await deliveryBoy.save()

    res.json({
      success: true,
      message: 'Delivery boy updated successfully',
      deliveryBoy: deliveryBoy.getPublicProfile()
    })
  } catch (error) {
    console.error('Update delivery boy error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to update delivery boy',
      error: error.message
    })
  }
})

/**
 * PATCH /admin/delivery-boys/:id/block
 * Toggle delivery boy blocked status (admin only)
 */
router.patch('/:id/block', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params
    const { isBlocked } = req.body

    const deliveryBoy = await DeliveryBoy.findById(id)
    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: 'Delivery boy not found'
      })
    }

    deliveryBoy.isBlocked = isBlocked !== undefined ? isBlocked : !deliveryBoy.isBlocked
    await deliveryBoy.save()

    res.json({
      success: true,
      message: `Delivery boy ${deliveryBoy.isBlocked ? 'blocked' : 'unblocked'} successfully`,
      deliveryBoy: deliveryBoy.getPublicProfile()
    })
  } catch (error) {
    console.error('Block delivery boy error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to update delivery boy block status',
      error: error.message
    })
  }
})

/**
 * DELETE /admin/delivery-boys/:id
 * Delete delivery boy (admin only)
 */
router.delete('/:id', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params

    const deliveryBoy = await DeliveryBoy.findById(id)
    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: 'Delivery boy not found'
      })
    }

    // Check if delivery boy has active orders
    const activeOrders = await Order.countDocuments({
      deliveryBoy: id,
      status: { $in: ['processing', 'out for delivery'] }
    })

    if (activeOrders > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete delivery boy with ${activeOrders} active order(s)`
      })
    }

    await DeliveryBoy.findByIdAndDelete(id)

    res.json({
      success: true,
      message: 'Delivery boy deleted successfully'
    })
  } catch (error) {
    console.error('Delete delivery boy error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to delete delivery boy',
      error: error.message
    })
  }
})

export default router

