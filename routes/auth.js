const express = require('express')
const jwt = require('jsonwebtoken')
const { body, validationResult } = require('express-validator')
const User = require('../models/User')
const { auth } = require('../middleware/auth')

const router = express.Router()

// Send OTP
router.post('/send-otp', [
  body('phoneNumber')
    .isMobilePhone('en-IN')
    .withMessage('Please provide a valid Indian phone number')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array()
      })
    }

    const { phoneNumber } = req.body
    
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    
    // In production, send OTP via SMS service (Twilio, etc.)
    console.log(`OTP for ${phoneNumber}: ${otp}`)
    
    // Store OTP in Redis with expiration (5 minutes)
    // For now, we'll store it in memory (not recommended for production)
    if (!global.otpStore) {
      global.otpStore = new Map()
    }
    global.otpStore.set(phoneNumber, { otp, expires: Date.now() + 5 * 60 * 1000 })
    
    // TODO: Integrate with SMS service
    // await sendSMS(phoneNumber, `Your MediShop OTP is: ${otp}. Valid for 5 minutes.`)
    
    res.json({ 
      message: 'OTP sent successfully',
      // Remove this in production
      otp: process.env.NODE_ENV === 'development' ? otp : undefined
    })
  } catch (error) {
    console.error('Send OTP error:', error)
    res.status(500).json({ message: 'Failed to send OTP' })
  }
})

// Verify OTP and login/register
router.post('/verify-otp', [
  body('phoneNumber')
    .isMobilePhone('en-IN')
    .withMessage('Please provide a valid Indian phone number'),
  body('otp')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('Please provide a valid 6-digit OTP')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array()
      })
    }

    const { phoneNumber, otp } = req.body
    
    // Verify OTP
    if (!global.otpStore) {
      return res.status(400).json({ message: 'OTP not found. Please request a new OTP.' })
    }
    
    const storedOtp = global.otpStore.get(phoneNumber)
    if (!storedOtp || storedOtp.expires < Date.now()) {
      global.otpStore.delete(phoneNumber)
      return res.status(400).json({ message: 'OTP expired. Please request a new OTP.' })
    }
    
    if (storedOtp.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP.' })
    }
    
    // Clear OTP after successful verification
    global.otpStore.delete(phoneNumber)
    
    // Find or create user
    let user = await User.findOne({ phoneNumber })
    
    if (!user) {
      user = new User({
        phoneNumber,
        isVerified: true
      })
      await user.save()
    } else {
      user.isVerified = true
      await user.save()
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, phoneNumber: user.phoneNumber },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )
    
    res.json({
      message: 'Login successful',
      user: user.getPublicProfile(),
      token
    })
  } catch (error) {
    console.error('Verify OTP error:', error)
    res.status(500).json({ message: 'Failed to verify OTP' })
  }
})

// Verify token
router.get('/verify', auth, async (req, res) => {
  res.json({
    user: req.user.getPublicProfile()
  })
})

// Logout
router.post('/logout', auth, async (req, res) => {
  // In a more sophisticated setup, you might want to blacklist the token
  res.json({ message: 'Logout successful' })
})

module.exports = router




