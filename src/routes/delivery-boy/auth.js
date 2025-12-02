import express from 'express'
import { body, validationResult } from 'express-validator'
import jwt from 'jsonwebtoken'
import DeliveryBoy from '../../../models/DeliveryBoy.js'

const router = express.Router()

/**
 * POST /delivery-boy/auth/login
 * Login delivery boy
 */
router.post('/login', [
  body('phone').trim().matches(/^[0-9]{10}$/).withMessage('Phone must be 10 digits'),
  body('password').notEmpty().withMessage('Password is required')
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

    const { phone, password } = req.body

    // Find delivery boy with password
    const deliveryBoy = await DeliveryBoy.findOne({ phone }).select('+password')

    if (!deliveryBoy) {
      return res.status(401).json({
        success: false,
        message: 'Invalid phone or password'
      })
    }

    // Check if blocked
    if (deliveryBoy.isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been blocked. Please contact admin.'
      })
    }

    // Check if active
    if (!deliveryBoy.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account is inactive. Please contact admin.'
      })
    }

    // Verify password
    const isPasswordValid = await deliveryBoy.comparePassword(password)
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid phone or password'
      })
    }

    // Generate token
    const token = jwt.sign(
      {
        deliveryBoyId: deliveryBoy._id,
        phone: deliveryBoy.phone,
        role: 'DELIVERY_BOY'
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    )

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        deliveryBoy: deliveryBoy.getPublicProfile()
      }
    })
  } catch (error) {
    console.error('Delivery boy login error:', error)
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    })
  }
})

/**
 * GET /delivery-boy/auth/me
 * Get current delivery boy profile
 */
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token required'
      })
    }

    let decoded
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key')
    } catch (jwtError) {
      console.error('JWT verification error in /me:', jwtError.message)
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      })
    }

    if (!decoded.deliveryBoyId) {
      console.error('Token missing deliveryBoyId in /me:', decoded)
      return res.status(401).json({
        success: false,
        message: 'Invalid token format'
      })
    }

    const deliveryBoy = await DeliveryBoy.findById(decoded.deliveryBoyId).select('-password -__v')

    if (!deliveryBoy) {
      console.error('Delivery boy not found in /me for ID:', decoded.deliveryBoyId)
      return res.status(404).json({
        success: false,
        message: 'Delivery boy not found. Please login again.'
      })
    }

    if (deliveryBoy.isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been blocked'
      })
    }

    if (!deliveryBoy.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account is inactive'
      })
    }

    res.json({
      success: true,
      data: {
        deliveryBoy: deliveryBoy.getPublicProfile()
      }
    })
  } catch (error) {
    console.error('Get delivery boy profile error:', error)
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    })
  }
})

export default router


