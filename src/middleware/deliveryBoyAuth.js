import jwt from 'jsonwebtoken'
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

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key')
    const deliveryBoy = await DeliveryBoy.findById(decoded.deliveryBoyId)

    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: 'Delivery boy not found'
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


