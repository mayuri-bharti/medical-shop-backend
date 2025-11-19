import express from 'express'
import { body } from 'express-validator'
import { auth } from '../middleware/auth.js'
import {
  checkoutSelectedItems,
  getOrderById,
  getUserOrders,
  getOrderTracking,
  cancelOrder
} from '../controllers/orderController.js'
import User from '../../models/User.js'

const router = express.Router()

const checkoutValidators = [
  body('shippingAddress').isObject().withMessage('shippingAddress is required'),
  body('shippingAddress.name').trim().notEmpty().withMessage('Name is required'),
  body('shippingAddress.city').trim().notEmpty().withMessage('City is required'),
  body('shippingAddress.state').trim().notEmpty().withMessage('State is required'),
  body('shippingAddress.pincode').isPostalCode('IN').withMessage('Valid pincode is required'),
  body('shippingAddress.phone')
    .optional({ checkFalsy: true })
    .isMobilePhone('en-IN', { strictMode: false })
    .withMessage('Valid phone number is required'),
  body('shippingAddress.phoneNumber')
    .optional({ checkFalsy: true })
    .isMobilePhone('en-IN', { strictMode: false })
    .withMessage('Valid phone number is required'),
  body('shippingAddress').custom((address) => {
    const phone = address?.phone || address?.phoneNumber
    if (!phone) {
      throw new Error('Phone number is required')
    }

    const street = address?.street || address?.address
    if (!street || !String(street).trim()) {
      throw new Error('Street address is required')
    }

    return true
  }),
  body('paymentMethod').isIn(['COD', 'ONLINE', 'WALLET']).withMessage('Invalid payment method'),
  body('selectedItems').isArray({ min: 1 }).withMessage('selectedItems must include at least one entry'),
  body('selectedItems.*.cartItemId').optional().isMongoId().withMessage('cartItemId must be a valid identifier'),
  body('selectedItems.*.productId').optional().isMongoId().withMessage('productId must be a valid identifier'),
  body('selectedItems.*.medicineId').optional().isMongoId().withMessage('medicineId must be a valid identifier'),
  body('selectedItems.*.itemType').optional().isIn(['product', 'medicine']).withMessage('Invalid item type'),
  body('selectedItems.*.quantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('quantity must be at least 1'),
  body('selectedItems.*').custom((item) => {
    if (!item.cartItemId && !item.productId && !item.medicineId) {
      throw new Error('Provide either cartItemId or productId or medicineId for each selected item')
    }
    return true
  }),
  body('prescriptionId').optional().isMongoId().withMessage('prescriptionId must be a valid MongoDB ID')
]

/**
 * POST /orders or /orders/checkout
 * Selective checkout - turns only chosen cart items into an order.
 */
router.post(['/checkout', '/'], auth, checkoutValidators, checkoutSelectedItems)

/**
 * GET /orders
 * Fetch all orders for the signed-in user.
 */
router.get('/', auth, getUserOrders)

/**
 * GET /orders/my-orders
 * Alias for fetching the user's orders (kept for backward compatibility).
 */
router.get('/my-orders', auth, getUserOrders)

/**
 * GET /orders/:id/tracking
 * Return order with status history for tracking.
 * IMPORTANT: This route must come before /:id to avoid route conflicts.
 */
router.get('/:id/tracking', auth, getOrderTracking)

/**
 * POST /orders/select-address
 * Persist user's selected address for subsequent checkouts.
 */
router.post('/select-address', auth, async (req, res) => {
  try {
    const { addressId } = req.body || {}
    if (!addressId) {
      return res.status(400).json({
        success: false,
        message: 'Address ID is required'
      })
    }

    const user = await User.findById(req.user._id)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    const address = user.addresses.id(addressId)
    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found'
      })
    }

    user.defaultAddressId = address._id
    user.addresses = user.addresses.map((addr) => {
      addr.isDefault = addr._id.toString() === address._id.toString()
      return addr
    })

    await user.save()

    res.json({
      success: true,
      message: 'Address selected successfully',
      data: {
        addressId: address._id,
        address
      }
    })
  } catch (error) {
    console.error('Select address error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to select address'
    })
  }
})

/**
 * POST /orders/:id/cancel
 * Cancel an order with a provided reason.
 */
router.post('/:id/cancel', auth, [
  body('reason')
    .isString()
    .isLength({ min: 10, max: 500 })
], cancelOrder)

/**
 * GET /orders/:id
 * Return a single order that belongs to the user.
 */
router.get('/:id', auth, getOrderById)

export default router

