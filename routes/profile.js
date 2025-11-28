import express from 'express'
import { body, validationResult } from 'express-validator'
import multer from 'multer'
import User from '../models/User.js'
import { auth } from '../middleware/auth.js'
import { storeAvatarFile } from '../src/utils/avatarStorage.js'

const router = express.Router()

// Configure multer for avatar uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit for avatars
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, JPG, WEBP, and GIF images are allowed.'))
    }
  }
})

// Get user profile
router.get('/', auth, async (req, res) => {
  try {
    res.json({
      success: true,
      data: req.user.getPublicProfile()
    })
  } catch (error) {
    console.error('Get profile error:', error)
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch profile' 
    })
  }
})

// Update user profile
router.put('/', auth, [
  body('name').optional().isString().trim().isLength({ min: 2, max: 50 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().isString().trim(),
  body('alternatePhone').optional().isString().trim(),
  body('dateOfBirth')
    .optional({ values: 'falsy' })
    .custom((value) => {
      if (!value || value === '') return true
      // Check if it's a valid ISO8601 date
      const date = new Date(value)
      return !isNaN(date.getTime()) && value.match(/^\d{4}-\d{2}-\d{2}/)
    })
    .withMessage('Invalid date format. Use YYYY-MM-DD format'),
  body('gender').optional().isIn(['male', 'female', 'other', 'prefer_not_to_say']),
  body('avatar').optional().isString().trim(),
  body('address').optional().isString().trim().isLength({ max: 200 }),
  body('city').optional().isString().trim().isLength({ max: 50 }),
  body('state').optional().isString().trim().isLength({ max: 50 }),
  body('pincode').optional().isPostalCode('IN'),
  body('notifications.email').optional().isBoolean(),
  body('notifications.sms').optional().isBoolean(),
  body('notifications.push').optional().isBoolean(),
  body('preferences.language').optional().isIn(['en', 'hi', 'mr']),
  body('preferences.currency').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      })
    }

    const allowedUpdates = [
      'name', 'email', 'phone', 'alternatePhone', 'dateOfBirth', 'gender', 'avatar',
      'address', 'city', 'state', 'pincode', 'notifications', 'preferences'
    ]
    
    const updates = {}
    for (const field of allowedUpdates) {
      if (req.body[field] !== undefined) {
        if (field === 'dateOfBirth' && req.body[field]) {
          updates[field] = new Date(req.body[field])
        } else {
          updates[field] = req.body[field]
        }
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    )

    res.json({
      success: true,
      data: user.getPublicProfile()
    })
  } catch (error) {
    console.error('Update profile error:', error)
    res.status(500).json({ 
      success: false,
      message: 'Failed to update profile' 
    })
  }
})

// Delete user account
router.delete('/', auth, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.user._id)
    
    res.json({ message: 'Account deleted successfully' })
  } catch (error) {
    console.error('Delete account error:', error)
    res.status(500).json({ message: 'Failed to delete account' })
  }
})

// Upload profile picture
router.post('/avatar', auth, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      })
    }

    // Delete old avatar if exists (Cloudinary)
    if (req.user.avatar && req.user.avatar.includes('cloudinary.com')) {
      try {
        const { deleteFromCloudinary } = await import('../src/utils/cloudinary.js')
        // Extract public_id from URL
        const urlParts = req.user.avatar.split('/')
        const publicIdWithExt = urlParts[urlParts.length - 1].split('.')[0]
        const folder = 'avatars'
        const publicId = `${folder}/${publicIdWithExt}`
        await deleteFromCloudinary(publicId)
      } catch (deleteError) {
        console.warn('Failed to delete old avatar from Cloudinary:', deleteError.message)
        // Continue anyway
      }
    }

    // Store new avatar
    const fileMetadata = await storeAvatarFile(req.file)

    // Update user avatar
    req.user.avatar = fileMetadata.url
    await req.user.save()

    res.json({
      success: true,
      message: 'Profile picture uploaded successfully',
      data: {
        avatar: fileMetadata.url
      }
    })
  } catch (error) {
    console.error('Upload avatar error:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload profile picture'
    })
  }
})

// Get user statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const { default: Order } = await import('../models/Order.js')
    const { default: Prescription } = await import('../models/Prescription.js')
    
    const [ordersCount, prescriptionsCount] = await Promise.all([
      Order.countDocuments({ user: req.user._id }),
      Prescription.countDocuments({ user: req.user._id, isActive: true })
    ])

    res.json({
      ordersCount,
      prescriptionsCount,
      memberSince: req.user.createdAt
    })
  } catch (error) {
    console.error('Get user stats error:', error)
    res.status(500).json({ message: 'Failed to fetch user statistics' })
  }
})

export default router




