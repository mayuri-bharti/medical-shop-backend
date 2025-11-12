import jwt from 'jsonwebtoken'
import Admin from '../../models/Admin.js'
import User from '../../models/User.js'

/**
 * Admin authentication middleware to verify JWT token
 * Only allows admins to access protected routes
 */
export const verifyAdminToken = async (req, res, next) => {
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
    
    // Check if token is for admin
    if (decoded.role !== 'ADMIN') {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied. Admin privileges required.' 
      })
    }
    
    // Try to find admin in Admin model first
    let admin = await Admin.findById(decoded.userId)
    
    // If not found in Admin model, check User model
    if (!admin) {
      const user = await User.findById(decoded.userId)
      if (user && user.role === 'ADMIN') {
        admin = user
      }
    }
    
    // Check if admin exists and is valid
    if (!admin) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid token. Admin not found.' 
      })
    }
    
    // For Admin model, check isAdmin field (if it exists)
    if (admin.isAdmin !== undefined && !admin.isAdmin) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid token. Admin privileges not granted.' 
      })
    }

    // Attach admin to request object
    req.admin = admin
    req.adminId = admin._id
    
    next()
  } catch (error) {
    console.error('Admin auth middleware error:', error.message)
    
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
    
    res.status(500).json({ 
      success: false, 
      message: 'Authentication error.' 
    })
  }
}





















