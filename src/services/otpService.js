/**
 * OTP Service
 * Handles OTP generation, verification, rate limiting, and token creation
 */

const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const Otp = require('../../models/Otp')
const User = require('../../models/User')

// Redis client (optional)
let redisClient = null
if (process.env.REDIS_URL) {
  try {
    const redis = require('redis')
    redisClient = redis.createClient({ url: process.env.REDIS_URL })
    
    redisClient.on('error', (err) => {
      console.warn('Redis client error:', err.message)
    })
    
    redisClient.connect().catch(() => {
      redisClient = null
      console.log('⚠️  Continuing without Redis rate limiting')
    })
  } catch (error) {
    console.log('⚠️  Redis not available, using in-memory rate limiting')
  }
}

/**
 * Generate OTP for phone number
 * @param {string} phone - Phone number
 * @param {string} purpose - OTP purpose ('LOGIN' or 'RESET')
 * @returns {Promise<{success: boolean, otp: string, message: string}>}
 * @throws {Error} If rate limit exceeded or generation fails
 * 
 * Status codes:
 * - 200: OTP generated successfully
 * - 429: Rate limit exceeded (too many requests)
 * - 500: Internal server error
 */
const generateOtp = async (phone, purpose = 'LOGIN') => {
  try {
    // Check rate limit (max 3 sends per hour)
    const rateLimitResult = await checkRateLimit(phone)
    
    if (!rateLimitResult.allowed) {
      const error = new Error(rateLimitResult.message)
      error.statusCode = 429 // Too Many Requests
      throw error
    }

    // Generate 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    
    // Hash OTP with bcrypt
    const saltRounds = 10
    const otpHash = await bcrypt.hash(otp, saltRounds)
    
    // Set expiry (5 minutes from now)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)
    
    // Find existing OTP or create new one
    const existingOtp = await Otp.findOne({ phone, purpose, isUsed: false })
    
    if (existingOtp) {
      // Update existing OTP
      existingOtp.otpHash = otpHash
      existingOtp.expiresAt = expiresAt
      existingOtp.attempts = 0
      existingOtp.isUsed = false
      existingOtp.sendCount += 1
      existingOtp.createdAt = new Date() // Update timestamp for rate limiting
      await existingOtp.save()
    } else {
      // Create new OTP
      const otpDoc = new Otp({
        phone,
        otpHash,
        purpose,
        expiresAt,
        attempts: 0,
        isUsed: false,
        sendCount: 1
      })
      await otpDoc.save()
    }
    
    // Update rate limit tracker (Redis or in-memory)
    await updateRateLimit(phone)
    
    console.log(`✅ OTP generated for ${phone} (${purpose}), Send count: ${(existingOtp?.sendCount || 0) + 1}`)
    
    return {
      success: true,
      otp, // Only returned in response, not stored in plain text
      message: 'OTP generated successfully'
    }
  } catch (error) {
    console.error('Generate OTP error:', error.message)
    throw error
  }
}

/**
 * Check rate limit for phone number
 * Max 3 sends per hour per phone number
 * @param {string} phone - Phone number
 * @returns {Promise<{allowed: boolean, message: string}>}
 */
const checkRateLimit = async (phone) => {
  const MAX_SENDS_PER_HOUR = 3
  const ONE_HOUR_MS = 60 * 60 * 1000
  const currentTime = Date.now()
  
  // Try Redis first if available
  if (redisClient) {
    try {
      const key = `otp_rate_limit:${phone}`
      const count = await redisClient.incr(key)
      
      if (count === 1) {
        // First request, set expiry
        await redisClient.expire(key, 3600) // 1 hour
      }
      
      if (count > MAX_SENDS_PER_HOUR) {
        return {
          allowed: false,
          message: 'Too many OTP requests. Please try again after some time.'
        }
      }
    } catch (error) {
      console.warn('Redis rate limit check failed, falling back to DB:', error.message)
    }
  }
  
  // Fallback: Check database
  const oneHourAgo = new Date(currentTime - ONE_HOUR_MS)
  
  const recentOtp = await Otp.findOne({
    phone,
    createdAt: { $gte: oneHourAgo }
  }).sort({ createdAt: -1 })
  
  if (recentOtp) {
    // Calculate send count in last hour
    const otpsInLastHour = await Otp.countDocuments({
      phone,
      createdAt: { $gte: oneHourAgo }
    })
    
    if (otpsInLastHour >= MAX_SENDS_PER_HOUR) {
      return {
        allowed: false,
        message: 'Too many OTP requests. Please try again after some time.'
      }
    }
  }
  
  return { allowed: true, message: 'OK' }
}

/**
 * Update rate limit tracker
 * @param {string} phone - Phone number
 */
const updateRateLimit = async (phone) => {
  if (redisClient) {
    try {
      const key = `otp_rate_limit:${phone}`
      await redisClient.incr(key)
      // Expiry is set on first increment
    } catch (error) {
      // Silently fail, DB tracking will handle it
    }
  }
}

/**
 * Verify OTP
 * @param {string} phone - Phone number
 * @param {string} otp - 6-digit OTP to verify
 * @param {string} purpose - OTP purpose ('LOGIN' or 'RESET')
 * @returns {Promise<{success: boolean, isLocked: boolean, attemptsLeft: number, message: string}>}
 * @throws {Error} If verification fails
 * 
 * Status codes:
 * - 200: OTP verified successfully
 * - 400: Invalid OTP
 * - 403: Account locked (too many failed attempts)
 * - 410: OTP expired
 * - 500: Internal server error
 */
const verifyOtp = async (phone, otp, purpose = 'LOGIN') => {
  try {
    // Find the latest unexpired OTP
    const otpDoc = await Otp.findOne({
      phone,
      purpose,
      isUsed: false,
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 })
    
    if (!otpDoc) {
      const error = new Error('OTP not found or expired. Please request a new OTP.')
      error.statusCode = 410 // Gone
      throw error
    }
    
    // Check if account is locked (5 failed attempts)
    if (otpDoc.attempts >= 5) {
      const lockDuration = 15 * 60 * 1000 // 15 minutes
      const lockTime = new Date(otpDoc.updatedAt.getTime() + lockDuration)
      const now = new Date()
      
      if (lockTime > now) {
        const error = new Error('Too many failed attempts. Please try again later.')
        error.statusCode = 403 // Forbidden
        throw error
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
      
      if (attemptsLeft > 0) {
        const error = new Error(`Invalid OTP. ${attemptsLeft} attempt(s) remaining.`)
        error.statusCode = 400 // Bad Request
        error.attemptsLeft = attemptsLeft
        throw error
      } else {
        const error = new Error('Too many failed attempts. Account locked for 15 minutes.')
        error.statusCode = 403 // Forbidden
        throw error
      }
    }
    
    // OTP verified successfully
    // Mark OTP as used
    otpDoc.isUsed = true
    await otpDoc.save()
    
    console.log(`✅ OTP verified successfully for ${phone}`)
    
    return {
      success: true,
      message: 'OTP verified successfully',
      attemptsLeft: 0
    }
  } catch (error) {
    console.error('Verify OTP error:', error.message)
    throw error
  }
}

/**
 * Create or get user and generate tokens
 * @param {string} phone - Phone number
 * @returns {Promise<{user: Object, accessToken: string, refreshToken: string}>}
 * 
 * Status codes:
 * - 200: Success
 * - 500: Internal server error
 */
const createUserAndTokens = async (phone) => {
  try {
    // Find or create user
    let user = await User.findOne({ phone })
    
    if (!user) {
      // Create new user
      user = new User({
        phone,
        role: 'USER',
        isVerified: true
      })
      await user.save()
      console.log(`✅ New user created: ${phone}`)
    } else {
      // Update existing user as verified
      user.isVerified = true
      await user.save()
      console.log(`✅ User logged in: ${phone}`)
    }
    
    // Generate tokens
    const tokens = createTokens(user)
    
    return {
      user: {
        _id: user._id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified
      },
      ...tokens
    }
  } catch (error) {
    console.error('Create user and tokens error:', error.message)
    throw error
  }
}

/**
 * Create JWT tokens (access and refresh)
 * @param {User} user - User object
 * @returns {{accessToken: string, refreshToken: string}}
 */
const createTokens = (user) => {
  const payload = {
    userId: user._id,
    phone: user.phone,
    role: user.role
  }
  
  // Generate access token (24 hours)
  const accessToken = jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  )
  
  // Generate refresh token (7 days)
  const refreshToken = jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )
  
  return {
    accessToken,
    refreshToken
  }
}

/**
 * Refresh access token using refresh token
 * @param {string} refreshToken - Refresh token
 * @returns {{accessToken: string, refreshToken: string}}
 * @throws {Error} If refresh token is invalid
 * 
 * Status codes:
 * - 200: Token refreshed successfully
 * - 401: Invalid refresh token
 * - 500: Internal server error
 */
const refreshAccessToken = async (refreshToken) => {
  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET)
    
    // Get user
    const user = await User.findById(decoded.userId)
    
    if (!user) {
      const error = new Error('User not found')
      error.statusCode = 401 // Unauthorized
      throw error
    }
    
    // Generate new tokens
    const tokens = createTokens(user)
    
    return tokens
  } catch (error) {
    console.error('Refresh token error:', error.message)
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      error.statusCode = 401 // Unauthorized
    }
    
    throw error
  }
}

module.exports = {
  generateOtp,
  verifyOtp,
  createUserAndTokens,
  createTokens,
  refreshAccessToken
}





