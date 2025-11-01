const express = require('express')
const { body, validationResult } = require('express-validator')
const User = require('../models/User')
const { auth } = require('../middleware/auth')

const router = express.Router()

// Get user profile
router.get('/', auth, async (req, res) => {
  try {
    res.json(req.user.getPublicProfile())
  } catch (error) {
    console.error('Get profile error:', error)
    res.status(500).json({ message: 'Failed to fetch profile' })
  }
})

// Update user profile
router.put('/', auth, [
  body('name').optional().isString().trim().isLength({ min: 2, max: 50 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('address').optional().isString().trim().isLength({ max: 200 }),
  body('city').optional().isString().trim().isLength({ max: 50 }),
  body('state').optional().isString().trim().isLength({ max: 50 }),
  body('pincode').optional().isPostalCode('IN'),
  body('preferences.notifications.email').optional().isBoolean(),
  body('preferences.notifications.sms').optional().isBoolean(),
  body('preferences.notifications.push').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array()
      })
    }

    const allowedUpdates = [
      'name', 'email', 'address', 'city', 'state', 'pincode', 'preferences'
    ]
    
    const updates = {}
    for (const field of allowedUpdates) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field]
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    )

    res.json(user.getPublicProfile())
  } catch (error) {
    console.error('Update profile error:', error)
    res.status(500).json({ message: 'Failed to update profile' })
  }
})

// Delete user account
router.delete('/', auth, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.user._id)
    
    res.json({ message: 'Account deleted successfully' })
  } catch (error) {
    console.error('Delete account error:', error)
    res.status(500).json({ message: 'Failed to delete account' })
  }
})

// Get user statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const Order = require('../models/Order')
    const Prescription = require('../models/Prescription')
    
    const [ordersCount, prescriptionsCount] = await Promise.all([
      Order.countDocuments({ user: req.user._id }),
      Prescription.countDocuments({ user: req.user._id, isActive: true })
    ])

    res.json({
      ordersCount,
      prescriptionsCount,
      memberSince: req.user.createdAt
    })
  } catch (error) {
    console.error('Get user stats error:', error)
    res.status(500).json({ message: 'Failed to fetch user statistics' })
  }
})

module.exports = router




