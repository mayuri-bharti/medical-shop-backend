import express from 'express'
import { body, validationResult } from 'express-validator'
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs'
import User from '../../models/User.js'
import { auth } from '../middleware/auth.js'
import { sendOtpSms } from '../services/otpProvider.js'
import { generateOtp, verifyOtp, createUserAndTokens, refreshAccessToken, createTokens } from '../services/otpService.js'

const router = express.Router()

// In-memory rate limiting storage (simple implementation)
// For production: Use express-rate-limit with Redis store
const rateLimitStore = {
  byIP: new Map(),
  byPhone: new Map()
}

/**
 * Rate limiting middleware
 * Limits requests by IP and by phone number
 * For production: Use express-rate-limit package with Redis store
 */
const checkRateLimit = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress
  const phone = req.body.phone
  
  const WINDOW_MS =1* 60 * 1000 // 1 minute
  const MAX_REQUESTS = 5 // Max 5 requests per minute per IP/phone
  
  // Check IP rate limit
  if (rateLimitStore.byIP.has(ip)) {
    const ipData = rateLimitStore.byIP.get(ip)
    if (Date.now() - ipData.firstRequest < WINDOW_MS) {
      if (ipData.count >= MAX_REQUESTS) {
        return res.status(429).json({
          success: false,
          message: 'Too many requests from this IP. Please try again later.'
        })
      }
      ipData.count++
    } else {
      rateLimitStore.byIP.set(ip, { count: 1, firstRequest: Date.now() })
    }
  } else {
    rateLimitStore.byIP.set(ip, { count: 1, firstRequest: Date.now() })
  }
  
  // Check phone rate limit
  if (phone && rateLimitStore.byPhone.has(phone)) {
    const phoneData = rateLimitStore.byPhone.get(phone)
    if (Date.now() - phoneData.firstRequest < WINDOW_MS) {
      if (phoneData.count >= MAX_REQUESTS) {
        return res.status(429).json({
          success: false,
          message: 'Too many requests for this phone number. Please try again later.'
        })
      }
      phoneData.count++
    } else {
      rateLimitStore.byPhone.set(phone, { count: 1, firstRequest: Date.now() })
    }
  } else if (phone) {
    rateLimitStore.byPhone.set(phone, { count: 1, firstRequest: Date.now() })
  }
  
  // Clean up old entries (simple cleanup)
  if (rateLimitStore.byIP.size > 10000 || rateLimitStore.byPhone.size > 10000) {
    const now = Date.now()
    for (const [key, value] of rateLimitStore.byIP.entries()) {
      if (now - value.firstRequest > WINDOW_MS) rateLimitStore.byIP.delete(key)
    }
    for (const [key, value] of rateLimitStore.byPhone.entries()) {
      if (now - value.firstRequest > WINDOW_MS) rateLimitStore.byPhone.delete(key)
    }
  }
  
  next()
}

/**
 * POST /auth/send-otp
 * Send OTP to phone number
 * 
 * Rate limiting:
 * - Endpoint rate limit: checkRateLimit middleware (in-memory)
 * - OTP send limit: otpService.generateOtp (3 per hour per phone)
 * 
 * For production with express-rate-limit and Redis:
 * const rateLimit = require('express-rate-limit')
 * const RedisStore = require('rate-limit-redis')
 * const limiter = rateLimit({
 *   store: new RedisStore({ client: redisClient }),
 *   windowMs: 60 * 1000,
 *   max: 5
 * })
 * router.post('/send-otp', limiter, [...])
 * 
 * Status codes: 200 (success), 400 (validation), 429 (rate limit), 500 (error)
 */
router.post('/send-otp', checkRateLimit, [
  body('phone')
    .isMobilePhone('en-IN', { strictMode: false })
    .withMessage('Please provide a valid Indian phone number')
    .trim()
], async (req, res) => {
  try {
    console.log("1")
    // Check MongoDB connection - wait a bit if connecting
    if (mongoose.connection.readyState !== 1) {
      // If connecting (state 2), wait a moment
      if (mongoose.connection.readyState === 2) {
        let waited = 0
        const maxWait = 3000 // 3 seconds
        while (mongoose.connection.readyState === 2 && waited < maxWait) {
          await new Promise(resolve => setTimeout(resolve, 200))
          waited += 200
          if (mongoose.connection.readyState === 1) break
        }
      }
      
      // If still not connected, return error
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({
          success: false,
          message: 'Database connection not ready. Please try again in a moment.'
        })
      }
    }
    console.log("2")
    // Validate input
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      })
    }
    console.log("3")
    const { phone } = req.body
    console.log("4")
    // Generate OTP using service (includes rate limiting: 3 per hour)
    const result = await generateOtp(phone, 'LOGIN')
    
    console.log(`📱 Attempting to send OTP to ${phone} via ${process.env.OTP_PROVIDER || 'mock'}`)
    console.log("5")
    // Send OTP via SMS provider
    let smsResult
    try {
      const smsMessage = `Your MediShop OTP is ${result.otp}. Valid for 5 minutes. Do not share with anyone.`
      smsResult = await sendOtpSms(phone, smsMessage)
      
      console.log(`✅ SMS sent successfully via ${smsResult.provider}`, {
        messageId: smsResult.messageId,
        phone: phone
      })
    } catch (smsError) {
      console.error('❌ Failed to send SMS:', {
        error: smsError.message,
        phone: phone,
        provider: process.env.OTP_PROVIDER,
        stack: smsError.stack
      })
      
      // Return error to user if SMS fails
      return res.status(500).json({
        success: false,
        message: `Failed to send OTP: ${smsError.message}. Please check your phone number or try again later.`,
        error: process.env.NODE_ENV === 'development' ? smsError.message : undefined
      })
    }
    
    // Calculate resend cooldown timestamp (5 minutes from now)
    const resendCooldown = new Date(Date.now() + 5 * 60 * 1000)
    
    res.status(200).json({ 
      success: true,
      message: 'OTP sent successfully',
      data: {
        resendCooldown: resendCooldown.toISOString(),
        provider: smsResult.provider,
        // Only return OTP in development environment
        ...(process.env.NODE_ENV === 'development' && { otp: result.otp })
      }
    })
  } catch (error) {
    console.error('Send OTP error:', error.message)
    
    const statusCode = error.statusCode || 500
    res.status(statusCode).json({ 
      success: false,
      message: error.message 
    })
  }
})

/**
 * POST /auth/verify-otp
 * Verify OTP and login/register user
 * 
 * Rate limiting:
 * - Endpoint rate limit: checkRateLimit middleware (in-memory)
 * - OTP verification limit: otpService.verifyOtp (5 attempts max)
 * 
 * For production with express-rate-limit and Redis:
 * const limiter = rateLimit({
 *   store: new RedisStore({ client: redisClient }),
 *   windowMs: 15 * 60 * 1000,
 *   max: 10 // Allow more verification attempts
 * })
 * router.post('/verify-otp', limiter, [...])
 * 
 * Status codes: Protected route
 * - 200 (success), 400 (invalid OTP), 403 (locked), 410 (expired), 500 (error)
 */
router.post('/verify-otp', checkRateLimit, [
  body('phone')
    .isMobilePhone('en-IN', { strictMode: false })
    .withMessage('Please provide a valid Indian phone number'),
  body('otp')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('Please provide a valid 6-digit OTP')
], async (req, res) => {
  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'Database connection not ready. Please try again in a moment.'
      })
    }

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
    
    // Verify OTP (includes attempt tracking and locking)
    await verifyOtp(phone, otp, 'LOGIN')
    
    // Create user and generate tokens
    const authResult = await createUserAndTokens(phone)
    
    // Set refresh token as secure HttpOnly cookie (if FRONTEND_BASE_URL is set)
    if (process.env.FRONTEND_BASE_URL) {
      res.cookie('refreshToken', authResult.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      })
    }
    
    // Return access token and user info in body
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: authResult.user,
        accessToken: authResult.accessToken,
        // Include refresh token in body if not using cookies
        ...(process.env.FRONTEND_BASE_URL ? {} : { refreshToken: authResult.refreshToken })
      }
    })
  } catch (error) {
    console.error('Verify OTP error:', error.message)
    
    const statusCode = error.statusCode || 500
    
    // Return appropriate 4xx codes
    if (statusCode >= 400 && statusCode < 500) {
      res.status(statusCode).json({ 
        success: false,
        message: error.message,
        ...(error.attemptsLeft !== undefined && { attemptsLeft: error.attemptsLeft })
      })
    } else {
      res.status(500).json({ 
        success: false,
        message: 'Internal server error'
      })
    }
  }
})

/**
 * Register new user with email/phone/name and password
 * POST /api/auth/register
 */
router.post('/register', [
  body('phone')
    .optional()
    .isMobilePhone('en-IN', { strictMode: false })
    .withMessage('Please provide a valid Indian phone number')
    .trim(),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters'),
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
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'Database connection not ready. Please try again in a moment.'
      })
    }

    // Validate input
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      })
    }

    const { phone, email, name, password, confirmPassword } = req.body

    // At least one identifier must be provided
    if (!phone && !email && !name) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least one of: phone, email, or name'
      })
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        ...(phone ? [{ phone }] : []),
        ...(email ? [{ email: email.toLowerCase() }] : []),
        ...(name ? [{ name }] : [])
      ]
    })

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User already exists. Please login instead.'
      })
    }

    // Create new user
    const user = new User({
      phone: phone || undefined,
      email: email ? email.toLowerCase() : undefined,
      name: name || undefined,
      password: password,
      role: 'USER',
      isVerified: true
    })

    await user.save()

    console.log(`✅ New user registered: ${phone || email || name}`)

    // Generate tokens
    const tokens = createTokens(user)

    // Set refresh token as secure HttpOnly cookie (if FRONTEND_BASE_URL is set)
    if (process.env.FRONTEND_BASE_URL) {
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      })
    }

    // Return access token and user info
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role
        },
        accessToken: tokens.accessToken,
        ...(process.env.FRONTEND_BASE_URL ? {} : { refreshToken: tokens.refreshToken })
      }
    })
  } catch (error) {
    console.error('Registration error:', error.message)
    
    // Handle duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0]
      return res.status(409).json({
        success: false,
        message: `User already exists with this ${field}. Please login instead.`
      })
    }
    
    res.status(500).json({ 
      success: false,
      message: error.message || 'Failed to register'
    })
  }
})

/**
 * Login with password (email/phone/username + password)
 * POST /api/auth/login-password
 */
router.post('/login-password', [
  body('identifier')
    .notEmpty()
    .withMessage('Please provide phone, email, or username')
    .trim(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'Database connection not ready. Please try again in a moment.'
      })
    }

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

    // Find user by phone, email, or name (username)
    const user = await User.findOne({
      $or: [
        { phone: identifier },
        { email: identifier.toLowerCase() },
        { name: identifier }
      ]
    }).select('+password') // Include password field

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found. Please register first or use OTP login.',
        code: 'USER_NOT_FOUND'
      })
    }

    // Check if user has password set
    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: 'Password not set. Please use OTP login or set a password first.'
      })
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password)
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      })
    }

    // Generate tokens
    const tokens = createTokens(user)

    // Set refresh token as secure HttpOnly cookie (if FRONTEND_BASE_URL is set)
    if (process.env.FRONTEND_BASE_URL) {
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      })
    }

    // Update user last login
    user.isVerified = true
    await user.save()

    console.log(`✅ User password login successful for ${identifier}`)

    // Return access token and user info
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role
        },
        accessToken: tokens.accessToken,
        ...(process.env.FRONTEND_BASE_URL ? {} : { refreshToken: tokens.refreshToken })
      }
    })
  } catch (error) {
    console.error('Password login error:', error.message)
    
    res.status(500).json({ 
      success: false,
      message: error.message || 'Failed to login'
    })
  }
})

/**
 * POST /auth/refresh-token
 * Refresh access token using refresh token
 * 
 * Status codes: 200 (success), 400 (validation), 401 (invalid token), 500 (error)
 */
router.post('/refresh-token', [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required')
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

    // Get refresh token from body or cookie
    const refreshToken = req.body.refreshToken || req.cookies.refreshToken
    
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token not provided'
      })
    }
    
    // Refresh tokens
    const tokens = await refreshAccessToken(refreshToken)
    
    // Update refresh token cookie if using cookies
    if (process.env.FRONTEND_BASE_URL) {
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      })
    }
    
    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: tokens.accessToken,
        // Include refresh token in body if not using cookies
        ...(process.env.FRONTEND_BASE_URL ? {} : { refreshToken: tokens.refreshToken })
      }
    })
  } catch (error) {
    console.error('Refresh token error:', error.message)
    
    const statusCode = error.statusCode || 500
    res.status(statusCode).json({ 
      success: false,
      message: error.message 
    })
  }
})

/**
 * GET /auth/me
 * Get current user profile (protected route)
 * 
 * Status codes: 200 (success), 401 (unauthorized), 500 (error)
 */
router.get('/me', auth, async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        user: {
          _id: req.user._id,
          phone: req.user.phone,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
          isVerified: req.user.isVerified,
          createdAt: req.user.createdAt
        }
      }
    })
  } catch (error) {
    console.error('Get profile error:', error.message)
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch profile' 
    })
  }
})

/**
 * POST /auth/logout
 * Logout user
 * 
 * Status codes: 200 (success), 401 (unauthorized), 500 (error)
 */
router.post('/logout', auth, async (req, res) => {
  try {
    // Clear refresh token cookie
    if (process.env.FRONTEND_BASE_URL) {
      res.clearCookie('refreshToken')
    }
    
    // In a more sophisticated setup, you might want to blacklist the token
    // For now, just return success
    res.status(200).json({ 
      success: true,
      message: 'Logout successful' 
    })
  } catch (error) {
    console.error('Logout error:', error.message)
    res.status(500).json({ 
      success: false,
      message: 'Failed to logout' 
    })
  }
})

/**
 * POST /auth/set-password
 * Set or update user password
 * 
 * Status codes: 200 (success), 400 (validation), 401 (unauthorized), 500 (error)
 */
router.post('/set-password', auth, [
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

    // Get user from database
    const user = await User.findById(req.user._id).select('+password')
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    // Set password (will be hashed by mongoose pre-save hook)
    user.password = password
    await user.save()

    console.log(`✅ Password set successfully for user ${user.phone}`)

    res.status(200).json({
      success: true,
      message: 'Password set successfully'
    })
  } catch (error) {
    console.error('Set password error:', error.message)
    
    res.status(500).json({ 
      success: false,
      message: error.message || 'Failed to set password'
    })
  }
})

/**
 * POST /auth/change-password
 * Change user password (requires old password)
 * 
 * Status codes: 200 (success), 400 (validation), 401 (unauthorized/invalid old password), 500 (error)
 */
router.post('/change-password', auth, [
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

    // Get user from database with password
    const user = await User.findById(req.user._id).select('+password')
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    // Check if user has password set
    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: 'No password set. Please use set-password endpoint instead.'
      })
    }

    // Verify old password
    const isOldPasswordValid = await user.comparePassword(oldPassword)
    
    if (!isOldPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid old password'
      })
    }

    // Set new password (will be hashed by mongoose pre-save hook)
    user.password = newPassword
    await user.save()

    console.log(`✅ Password changed successfully for user ${user.phone}`)

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    })
  } catch (error) {
    console.error('Change password error:', error.message)
    
    res.status(500).json({ 
      success: false,
      message: error.message || 'Failed to change password'
    })
  }
})

export default router
