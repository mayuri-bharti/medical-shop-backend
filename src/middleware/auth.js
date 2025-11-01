const jwt = require('jsonwebtoken')
const User = require('../../models/User')

/**
 * Authentication middleware to verify JWT token
 * Sets req.user if token is valid
 */
const auth = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.header('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false,
        message: 'Access denied. No valid token provided.' 
      })
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'Access denied. No token provided.' 
      })
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    
    // Fetch user from database
    const user = await User.findById(decoded.userId)
    
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid token. User not found.' 
      })
    }

    // Attach user to request object
    req.user = user
    req.userId = user._id
    
    next()
  } catch (error) {
    console.error('Auth middleware error:', error.message)
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid token.' 
      })
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        message: 'Token expired.' 
      })
    }
    
    res.status(500).json({ success: false, message: 'Authentication error.' })
  }
}

/**
 * Optional authentication - doesn't fail if token is missing
 * Useful for routes that work with or without authentication
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next() // Continue without user
    }

    const token = authHeader.substring(7)
    
    if (!token) {
      return next() // Continue without user
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(decoded.userId)
    
    if (user) {
      req.user = user
      req.userId = user._id
    }
    
    next()
  } catch (error) {
    // Continue even if token is invalid
    next()
  }
}

/**
 * Admin authorization middleware - requires ADMIN role
 */
const adminAuth = (req, res, next) => {
  if (req.user && req.user.role === 'ADMIN') {
    return next()
  }
  
  return res.status(403).json({
    success: false,
    message: 'Access denied. Admin privileges required.'
  })
}

module.exports = {
  auth,
  optionalAuth,
  adminAuth
}

