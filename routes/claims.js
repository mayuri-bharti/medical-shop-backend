import express from 'express'
import multer from 'multer'
import { body, validationResult } from 'express-validator'
import mongoose from 'mongoose'
import { auth } from '../middleware/auth.js'
import { verifyAdminToken } from '../middleware/adminAuth.js'
import Claim from '../models/Claim.js'
import Order from '../models/Order.js'
import { storeClaimImage } from '../src/utils/claimStorage.js'

const router = express.Router()

// Helper function to safely convert IDs to strings
const safeToString = (value) => {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  if (typeof value.toString === 'function') {
    try {
      return String(value)
    } catch (e) {
      return null
    }
  }
  return String(value)
}

// Configure multer for multiple file uploads
const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 5 // Maximum 5 files
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, JPG, and WEBP images are allowed.'))
    }
  }
})

/**
 * POST /claims
 * Create a new claim
 */
router.post('/', auth, upload.array('images', 5), async (req, res) => {
  try {
    // Wrap everything in try-catch to handle any unexpected errors
    // Parse items from JSON string if sent via FormData
    let items = req.body.items
    
    // Check if items is a string (when sent via FormData as JSON)
    if (typeof items === 'string') {
      try {
        items = JSON.parse(items)
        req.body.items = items // Update req.body
        console.log('Parsed items from JSON:', items)
      } catch (parseError) {
        console.error('Failed to parse items JSON:', parseError)
        console.error('Items value:', req.body.items)
        return res.status(400).json({
          success: false,
          message: 'Invalid items format',
          errors: [{ 
            type: 'field',
            value: req.body.items,
            msg: 'Items must be a valid JSON array',
            path: 'items',
            location: 'body'
          }]
        })
      }
    }

    // Manual validation (since express-validator doesn't work well with FormData)
    const { orderId, reason, description } = req.body

    // Validate orderId
    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: [{ 
          type: 'field',
          value: orderId,
          msg: 'Valid order ID is required',
          path: 'orderId',
          location: 'body'
        }]
      })
    }

    // Validate items - make sure it's an array after parsing
    if (!items) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: [{ 
          type: 'field',
          value: req.body.items,
          msg: 'Items field is required',
          path: 'items',
          location: 'body'
        }]
      })
    }
    
    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: [{ 
          type: 'field',
          value: typeof items === 'string' ? items.substring(0, 100) : items,
          msg: 'Items must be an array',
          path: 'items',
          location: 'body'
        }]
      })
    }
    
    if (items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: [{ 
          type: 'field',
          value: items,
          msg: 'Please select at least one item for the claim',
          path: 'items',
          location: 'body'
        }]
      })
    }

    // Validate reason
    const validReasons = ['Wrong product', 'Damaged item', 'Item missing', 'Not delivered', 'Other']
    if (!reason || !validReasons.includes(reason)) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: [{ field: 'reason', message: 'Valid reason is required' }]
      })
    }

    // Validate description
    const desc = (description || '').trim()
    if (desc.length < 10 || desc.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: [{ field: 'description', message: 'Description must be between 10 and 1000 characters' }]
      })
    }

    // Find order with safe population
    let order
    try {
      order = await Order.findOne({
        _id: orderId,
        user: req.user._id
      }).populate({
        path: 'items.product',
        select: 'name _id images'
      })

      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        })
      }

      // Ensure items array exists and is accessible
      if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Order has no items to claim'
        })
      }
    } catch (orderError) {
      console.error('Error fetching order:', orderError)
      return res.status(500).json({
        success: false,
        message: 'Error fetching order details'
      })
    }

    // Check if order is delivered
    if (order.status !== 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'Claims can only be raised for delivered orders'
      })
    }

    // Check if claim already exists for this order
    const existingClaim = await Claim.findOne({ 
      order: orderId, 
      status: { $nin: ['rejected', 'resolved'] } 
    })
    
    if (existingClaim) {
      return res.status(400).json({
        success: false,
        message: 'A claim already exists for this order'
      })
    }

    // Validate and process items
    const claimItems = []
    if (!order.items || !Array.isArray(order.items)) {
      return res.status(400).json({
        success: false,
        message: 'Order has no items'
      })
    }

    for (const item of items) {
      try {
        if (!item || !item.orderItemId) {
          return res.status(400).json({
            success: false,
            message: 'Invalid item data: orderItemId is required'
          })
        }

        const itemOrderItemId = String(item.orderItemId || '')
        const itemProductId = item.productId ? String(item.productId) : null

        // Find matching order item with safe property access
        let orderItem = null
        for (const oi of order.items) {
          if (!oi) continue
          
          try {
            // Try to match by orderItemId string using safe conversion
            const oiId = safeToString(oi._id) || ''
            const oiOrderItemId = safeToString(oi.orderItemId) || ''
            
            // Try to match by product ID if available
            let oiProductId = null
            if (oi.product) {
              if (typeof oi.product === 'object' && oi.product._id) {
                oiProductId = safeToString(oi.product._id)
              } else if (typeof oi.product === 'string') {
                oiProductId = oi.product
              } else {
                oiProductId = safeToString(oi.product)
              }
            }
            
            if ((oiId && oiId === itemOrderItemId) || 
                (oiOrderItemId && oiOrderItemId === itemOrderItemId) || 
                (oiProductId && itemProductId && oiProductId === itemProductId)) {
              orderItem = oi
              break
            }
          } catch (compareError) {
            console.error('Error comparing order item:', compareError)
            continue
          }
        }

        if (!orderItem) {
          return res.status(400).json({
            success: false,
            message: `Order item ${item.orderItemId} not found in this order`
          })
        }

        // Safely extract IDs using helper
        const orderItemId = safeToString(orderItem.orderItemId) || safeToString(orderItem._id)
        
        if (!orderItemId) {
          return res.status(400).json({
            success: false,
            message: 'Order item has no valid identifier'
          })
        }

        // Safely extract product/medicine IDs
        let productId = null
        if (orderItem.product) {
          if (typeof orderItem.product === 'object' && orderItem.product._id) {
            productId = orderItem.product._id
          } else if (typeof orderItem.product === 'string') {
            productId = orderItem.product
          }
        }

        let medicineId = null
        if (orderItem.medicine) {
          if (typeof orderItem.medicine === 'object' && orderItem.medicine._id) {
            medicineId = orderItem.medicine._id
          } else if (typeof orderItem.medicine === 'string') {
            medicineId = orderItem.medicine
          }
        }

        claimItems.push({
          orderItemId: orderItemId,
          product: productId,
          medicine: medicineId,
          name: orderItem.name || 'Unknown Item',
          quantity: Number(item.quantity) || Number(orderItem.quantity) || 1,
          price: Number(orderItem.price) || 0
        })
      } catch (itemError) {
        console.error('Error processing claim item:', itemError)
        return res.status(400).json({
          success: false,
          message: `Error processing item: ${itemError.message || 'Invalid item data'}`
        })
      }
    }

    // Process uploaded images
    const imageArray = []
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const imageData = await storeClaimImage(file)
          imageArray.push({
            url: imageData.url,
            publicId: imageData.publicId || null,
            filename: imageData.filename
          })
        } catch (imageError) {
          console.error('Failed to store claim image:', imageError)
          // Continue with other images even if one fails
        }
      }
    }

    // Create claim
    const claim = new Claim({
      user: req.user._id,
      order: orderId,
      items: claimItems,
      reason,
      description: description.trim(),
      images: imageArray,
      status: 'pending'
    })

    await claim.save()

    // Populate user and order for response
    await claim.populate('user', 'name email phone')
    await claim.populate('order', 'orderNumber total status')

    res.status(201).json({
      success: true,
      message: 'Claim raised successfully',
      data: claim
    })
  } catch (error) {
    console.error('Create claim error:', error)
    console.error('Error stack:', error.stack)
    console.error('Request body:', {
      orderId: req.body.orderId,
      reason: req.body.reason,
      description: req.body.description,
      items: typeof req.body.items === 'string' ? req.body.items.substring(0, 200) : req.body.items
    })
    
    // Provide more specific error messages
    if (error.message && error.message.includes('toString')) {
      return res.status(500).json({
        success: false,
        message: 'Error processing order items. Please ensure all selected items are valid.'
      })
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create claim'
    })
  }
})

/**
 * GET /claims/user/:userId
 * Get all claims for a user
 */
router.get('/user/:userId', auth, async (req, res) => {
  try {
    // Users can only view their own claims
    const userId = req.user?._id ? String(req.user._id) : null
    const requestedUserId = req.params.userId ? String(req.params.userId) : null
    
    if (!userId || !requestedUserId || userId !== requestedUserId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      })
    }

    const claims = await Claim.find({ user: req.user._id })
      .populate('order', 'orderNumber total status createdAt')
      .sort({ createdAt: -1 })

    res.json({
      success: true,
      data: claims
    })
  } catch (error) {
    console.error('Get user claims error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch claims'
    })
  }
})

/**
 * GET /claims/my-claims
 * Get current user's claims
 */
router.get('/my-claims', auth, async (req, res) => {
  try {
    const claims = await Claim.find({ user: req.user._id })
      .populate('order', 'orderNumber total status createdAt shippingAddress')
      .sort({ createdAt: -1 })

    res.json({
      success: true,
      data: claims
    })
  } catch (error) {
    console.error('Get my claims error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch claims'
    })
  }
})

/**
 * GET /claims
 * Get all claims (admin only)
 */
router.get('/', verifyAdminToken, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1)
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200)
    const skip = (page - 1) * limit

    const filter = {}

    if (req.query.status && req.query.status !== 'all') {
      filter.status = req.query.status
    }

    if (req.query.userId) {
      filter.user = req.query.userId
    }

    if (req.query.orderId) {
      filter.order = req.query.orderId
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

    const claims = await Claim.find(filter)
      .populate('user', 'name email phone')
      .populate('order', 'orderNumber total status createdAt shippingAddress')
      .populate('resolvedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-__v')

    const total = await Claim.countDocuments(filter)

    res.json({
      success: true,
      data: claims,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Get claims error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch claims'
    })
  }
})

/**
 * GET /claims/:id
 * Get single claim details
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('order', 'orderNumber total status createdAt shippingAddress items')
      .populate('resolvedBy', 'name email')

    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found'
      })
    }

    // Check if user has access (owner or admin)
    const claimUserId = claim.user?._id ? String(claim.user._id) : null
    const requestUserId = req.user?._id ? String(req.user._id) : null
    const isOwner = claimUserId && requestUserId && claimUserId === requestUserId
    const isAdmin = req.user?.role === 'admin'

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      })
    }

    res.json({
      success: true,
      data: claim
    })
  } catch (error) {
    console.error('Get claim error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch claim'
    })
  }
})

/**
 * PATCH /claims/:id
 * Update claim status (admin only)
 */
router.patch('/:id', verifyAdminToken, [
  body('status').optional().isIn(['pending', 'approved', 'rejected', 'resolved']).withMessage('Invalid status'),
  body('adminNote').optional().isString().trim()
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

    const { status, adminNote } = req.body

    const claim = await Claim.findById(req.params.id)

    if (!claim) {
      return res.status(404).json({
        success: false,
        message: 'Claim not found'
      })
    }

    if (status) {
      claim.status = status
    }

    if (adminNote !== undefined) {
      claim.adminNote = adminNote.trim() || null
    }

    if (status === 'resolved' || status === 'rejected') {
      claim.resolvedAt = new Date()
      claim.resolvedBy = req.admin._id
    }

    await claim.save()

    await claim.populate('user', 'name email phone')
    await claim.populate('order', 'orderNumber total status')
    await claim.populate('resolvedBy', 'name email')

    res.json({
      success: true,
      message: 'Claim updated successfully',
      data: claim
    })
  } catch (error) {
    console.error('Update claim error:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update claim'
    })
  }
})

export default router

