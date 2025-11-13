import jwt from 'jsonwebtoken'
import Admin from '../../models/Admin.js'
// REMOVED: import User from '../../models/User.js' - Users cannot access admin routes

/**
 * Admin authentication middleware to verify JWT token
 * SECURITY: Only allows admins from Admin model to access protected routes
 * Users from User model CANNOT access admin routes, even if they have ADMIN role in token
 * Only admins registered in the Admin collection with isAdmin: true can access
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
    
    // SECURITY FIX: ONLY check Admin model - do NOT check User model
    // This ensures that only admins registered in the Admin collection can access admin routes
    // Users from the User collection cannot access admin routes, even if they have ADMIN role
    const admin = await Admin.findById(decoded.userId)
    
    // Check if admin exists in Admin collection
    if (!admin) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid token. Admin not found. Only registered admins can access this route.' 
      })
    }
    
    // Check isAdmin field - must be true
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





















