import jwt from 'jsonwebtoken'
import Admin from '../models/Admin.js'

/**
 * Admin authentication middleware to verify JWT token.
 * Only admins stored in the Admin collection may access protected admin routes.
 */
export const verifyAdminToken = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No valid token provided.'
      })
    }

    const token = authHeader.substring(7)

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    if (decoded.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      })
    }

    const admin = await Admin.findById(decoded.userId)

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Admin not found.'
      })
    }

    if (admin.isAdmin !== undefined && !admin.isAdmin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Admin privileges not granted.'
      })
    }

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



