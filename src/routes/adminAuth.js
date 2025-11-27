import express from 'express'
import { body, validationResult } from 'express-validator'
import Admin from '../../models/Admin.js'
import Otp from '../../models/Otp.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { sendOtpSms } from '../services/otpProvider.js'
import { verifyAdminToken } from '../middleware/adminAuth.js'
import { ensureDatabaseConnection } from '../utils/ensureDatabaseConnection.js'

const router = express.Router()

const ensureDbOrRespond = async (res) => {
  try {
    await ensureDatabaseConnection()
    return true
  } catch (error) {
    console.error('Admin auth database readiness error:', error.message)
    res.status(503).json({
      success: false,
      message: 'Database connection not ready. Please try again in a moment.'
    })
    return false
  }
}

// Test route to verify adminAuth routes are working
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Admin auth routes are working!' })
})

/**
 * Generate OTP for admin phone number
 */
const generateAdminOtp = async (phone) => {
  // Generate 6-digit numeric OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  
  // Hash OTP with bcrypt
  const saltRounds = 10
  const otpHash = await bcrypt.hash(otp, saltRounds)
  
  // Set expiry (5 minutes from now)
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000)
  
  // Find existing OTP or create new one
  const existingOtp = await Otp.findOne({ phone, purpose: 'ADMIN_LOGIN', isUsed: false })
  
  if (existingOtp) {
    existingOtp.otpHash = otpHash
    existingOtp.expiresAt = expiresAt
    existingOtp.attempts = 0
    existingOtp.isUsed = false
    await existingOtp.save()
  } else {
    const otpDoc = new Otp({
      phone,
      otpHash,
      purpose: 'ADMIN_LOGIN',
      expiresAt,
      attempts: 0,
      isUsed: false,
      sendCount: 1
    })
    await otpDoc.save()
  }
  
  return otp
}

/**
 * Send OTP to admin phone number
 * POST /api/admin/send-otp
 */
router.post('/send-otp', [
  body('phone')
    .isMobilePhone('en-IN', { strictMode: false })
    .withMessage('Please provide a valid Indian phone number')
    .trim()
], async (req, res) => {
  try {
    if (!await ensureDbOrRespond(res)) return

    // Validate input
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      })
    }

    const { phone } = req.body
    
    // Check if phone number belongs to an admin
    const admin = await Admin.findOne({ phone, isAdmin: true })
    
    if (!admin) {
      return res.status(403).json({
        success: false,
        message: 'This phone number is not registered as an admin. Please contact system administrator.'
      })
    }
    
    // Generate OTP
    const otp = await generateAdminOtp(phone)
    
    console.log(`📱 Attempting to send admin OTP to ${phone}`)
    
    // Send OTP via SMS provider
    try {
      const smsMessage = `Your MediShop Admin OTP is ${otp}. Valid for 5 minutes. Do not share with anyone.`
      const smsResult = await sendOtpSms(phone, smsMessage)
      
      console.log(`✅ Admin OTP sent successfully via ${smsResult.provider}`)
      
      res.status(200).json({ 
        success: true,
        message: 'OTP sent successfully to admin phone number',
        data: {
          provider: smsResult.provider,
          // Only return OTP in development environment
          ...(process.env.NODE_ENV === 'development' && { otp })
        }
      })
    } catch (smsError) {
      console.error('❌ Failed to send SMS:', smsError.message)
      
      return res.status(500).json({
        success: false,
        message: `Failed to send OTP: ${smsError.message}. Please try again later.`,
        error: process.env.NODE_ENV === 'development' ? smsError.message : undefined
      })
    }
  } catch (error) {
    console.error('Admin send OTP error:', error.message)
    
    res.status(500).json({ 
      success: false,
      message: error.message || 'Failed to send OTP'
    })
  }
})

/**
 * Verify OTP and login admin
 * POST /api/admin/auth/verify-otp
 */
router.post('/verify-otp', [
  body('phone')
    .isMobilePhone('en-IN', { strictMode: false })
    .withMessage('Please provide a valid Indian phone number')
    .trim(),
  body('otp')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('OTP must be a 6-digit number')
], async (req, res) => {
  try {
    if (!await ensureDbOrRespond(res)) return

    // Validate input
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      })
    }

    const { phone, otp } = req.body
    
    // Find the latest unexpired OTP
    const otpDoc = await Otp.findOne({
      phone,
      purpose: 'ADMIN_LOGIN',
      isUsed: false,
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 })
    
    if (!otpDoc) {
      return res.status(410).json({
        success: false,
        message: 'OTP not found or expired. Please request a new OTP.'
      })
    }
    
    // Check if account is locked (5 failed attempts)
    if (otpDoc.attempts >= 5) {
      const lockDuration = 15 * 60 * 1000 // 15 minutes
      const lockTime = new Date(otpDoc.updatedAt.getTime() + lockDuration)
      const now = new Date()
      
      if (lockTime > now) {
        return res.status(403).json({
          success: false,
          message: 'Too many failed attempts. Please try again later.'
        })
      } else {
        // Lock period expired, reset attempts
        otpDoc.attempts = 0
        await otpDoc.save()
      }
    }
    
    // Verify OTP using bcrypt
    const isOtpValid = await bcrypt.compare(otp, otpDoc.otpHash)
    
    if (!isOtpValid) {
      // Increment attempt counter
      otpDoc.attempts += 1
      await otpDoc.save()
      
      const attemptsLeft = 5 - otpDoc.attempts
      
      return res.status(400).json({
        success: false,
        message: attemptsLeft > 0 
          ? `Invalid OTP. ${attemptsLeft} attempt(s) remaining.`
          : 'Too many failed attempts. Account locked for 15 minutes.'
      })
    }
    
    // OTP verified successfully
    // Mark OTP as used
    otpDoc.isUsed = true
    await otpDoc.save()
    
    // Get admin
    const admin = await Admin.findOne({ phone, isAdmin: true })
    
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found.'
      })
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: admin._id,
        role: 'ADMIN',
        phone: admin.phone
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )
    
    console.log(`✅ Admin OTP verified successfully for ${phone}`)
    
    res.status(200).json({
      success: true,
      message: 'Admin login successful',
      data: {
        accessToken: token,
        admin: {
          id: admin._id,
          name: admin.name,
          phone: admin.phone,
          email: admin.email
        }
      }
    })
  } catch (error) {
    console.error('Admin verify OTP error:', error.message)
    
    res.status(500).json({ 
      success: false,
      message: error.message || 'Failed to verify OTP'
    })
  }
})

/**
 * Login admin with password (phone/email/username + password)
 * POST /api/admin/auth/login-password
 */
router.post('/login-password', [
  body('identifier')
    .notEmpty()
    .withMessage('Please provide phone, email, username, or name')
    .trim(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    if (!await ensureDbOrRespond(res)) return

    // Validate input
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      })
    }

    const { identifier, password } = req.body

    // Find admin by phone, email, username, or name
    const admin = await Admin.findOne({
      $or: [
        { phone: identifier },
        { email: identifier.toLowerCase() },
        { username: identifier.toLowerCase() },
        { name: identifier }
      ],
      isAdmin: true
    }).select('+password') // Include password field

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      })
    }

    // Check if admin has password set
    if (!admin.password) {
      return res.status(400).json({
        success: false,
        message: 'Password not set. Please use OTP login or set a password first.'
      })
    }

    // Verify password
    const isPasswordValid = await admin.comparePassword(password)
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      })
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: admin._id,
        role: 'ADMIN',
        phone: admin.phone
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    console.log(`✅ Admin password login successful for ${identifier}`)

    res.status(200).json({
      success: true,
      message: 'Admin login successful',
      data: {
        accessToken: token,
        admin: {
          id: admin._id,
          name: admin.name,
          phone: admin.phone,
          email: admin.email
        }
      }
    })
  } catch (error) {
    console.error('Admin password login error:', error.message)
    
    res.status(500).json({ 
      success: false,
      message: error.message || 'Failed to login'
    })
  }
})

/**
 * POST /admin/auth/set-password
 * Set or update admin password
 * Protected route - requires admin authentication
 */
router.post('/set-password', verifyAdminToken, [
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match')
      }
      return true
    })
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      })
    }

    const { password } = req.body

    // Get admin from database (use adminId from middleware)
    const admin = await Admin.findById(req.adminId || req.admin._id).select('+password')
    
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      })
    }

    // Set password (will be hashed by mongoose pre-save hook)
    admin.password = password
    await admin.save()

    console.log(`✅ Password set successfully for admin ${admin.phone}`)

    res.status(200).json({
      success: true,
      message: 'Password set successfully'
    })
  } catch (error) {
    console.error('Set admin password error:', error.message)
    
    res.status(500).json({ 
      success: false,
      message: error.message || 'Failed to set password'
    })
  }
})

/**
 * POST /admin/auth/change-password
 * Change admin password (requires old password)
 * Protected route - requires admin authentication
 */
router.post('/change-password', verifyAdminToken, [
  body('oldPassword')
    .notEmpty()
    .withMessage('Old password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Passwords do not match')
      }
      return true
    })
], async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      })
    }

    const { oldPassword, newPassword } = req.body

    // Get admin from database with password (use adminId from middleware)
    const admin = await Admin.findById(req.adminId || req.admin._id).select('+password')
    
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      })
    }

    // Check if admin has password set
    if (!admin.password) {
      return res.status(400).json({
        success: false,
        message: 'No password set. Please use set-password endpoint instead.'
      })
    }

    // Verify old password
    const isOldPasswordValid = await admin.comparePassword(oldPassword)
    
    if (!isOldPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid old password'
      })
    }

    // Set new password (will be hashed by mongoose pre-save hook)
    admin.password = newPassword
    await admin.save()

    console.log(`✅ Password changed successfully for admin ${admin.phone}`)

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    })
  } catch (error) {
    console.error('Change admin password error:', error.message)
    
    res.status(500).json({ 
      success: false,
      message: error.message || 'Failed to change password'
    })
  }
})

export default router

