import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import DeliveryBoy from '../../models/DeliveryBoy.js'

/**
 * Middleware to verify delivery boy token
 */
export const verifyDeliveryBoyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      })
    }

    let decoded
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key')
    } catch (jwtError) {
      console.error('JWT verification error:', jwtError.message)
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      })
    }

    // Validate that deliveryBoyId exists in token
    if (!decoded.deliveryBoyId) {
      console.error('Token missing deliveryBoyId:', decoded)
      return res.status(401).json({
        success: false,
        message: 'Invalid token format'
      })
    }

    // Validate ObjectId format (Mongoose findById handles both string and ObjectId)
    if (!mongoose.Types.ObjectId.isValid(decoded.deliveryBoyId)) {
      console.error('Invalid ObjectId format:', decoded.deliveryBoyId)
      return res.status(401).json({
        success: false,
        message: 'Invalid token format'
      })
    }

    const deliveryBoy = await DeliveryBoy.findById(decoded.deliveryBoyId)

    if (!deliveryBoy) {
      console.error('Delivery boy not found for ID:', deliveryBoyId, 'Token decoded:', decoded)
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

    req.deliveryBoy = deliveryBoy
    req.deliveryBoyId = deliveryBoy._id
    next()
  } catch (error) {
    console.error('Delivery boy auth error:', error)
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    })
  }
}


