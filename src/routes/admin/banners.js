import express from 'express'
import multer from 'multer'
import { body, validationResult } from 'express-validator'
import { verifyAdminToken } from '../../middleware/adminAuth.js'
import Banner from '../../../models/Banner.js'
import { storeBannerImage } from '../../utils/bannerStorage.js'

const router = express.Router()

// Configure multer for banner image uploads
const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit for banners
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, JPG, and WEBP images are allowed.'))
    }
  }
})

/**
 * GET /api/admin/banners
 * Get all banners (admin only)
 */
router.get('/', verifyAdminToken, async (req, res) => {
  try {
    const banners = await Banner.find()
      .sort({ priority: -1, order: 1, createdAt: -1 })

    res.json({
      success: true,
      data: banners
    })
  } catch (error) {
    console.error('Get admin banners error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch banners'
    })
  }
})

/**
 * POST /api/admin/banners
 * Create new banner (admin only)
 */
router.post('/', verifyAdminToken, upload.single('image'), [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('subtitle').optional().trim(),
  body('description').optional().trim(),
  body('link').trim().notEmpty().withMessage('Link is required').custom((value) => {
    const isExternalUrl = value.startsWith('http://') || value.startsWith('https://')
    const isInternalRoute = value.startsWith('/')
    
    if (isExternalUrl) {
      try {
        new URL(value)
        return true
      } catch {
        throw new Error('Link must be a valid URL')
      }
    }
    
    if (isInternalRoute) {
      return true
    }
    
    throw new Error('Link must be a valid URL or internal route')
  }),
  body('offerText').optional().trim(),
  body('order').optional().isInt({ min: 0 }).withMessage('Order must be a non-negative integer'),
  body('priority').optional().isInt({ min: 0 }).withMessage('Priority must be a non-negative integer'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  body('startDate').optional().custom((value) => {
    if (!value || value === '') return true
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value) || !isNaN(Date.parse(value))
  }).withMessage('Start date must be a valid ISO 8601 date'),
  body('endDate').optional().custom((value) => {
    if (!value || value === '') return true
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value) || !isNaN(Date.parse(value))
  }).withMessage('End date must be a valid ISO 8601 date')
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

    const { title, subtitle, description, link, offerText, order, priority, isActive, startDate, endDate, imageUrl } = req.body

    let finalImageUrl = imageUrl

    // If file is uploaded, use it; otherwise use provided URL
    if (req.file) {
      // Store the banner image
      let fileMetadata
      try {
        fileMetadata = await storeBannerImage(req.file)
      } catch (storageError) {
        console.error('Banner upload error:', storageError)
        return res.status(500).json({
          success: false,
          message: storageError.message || 'Failed to upload banner image'
        })
      }

      if (!fileMetadata || !fileMetadata.url) {
        return res.status(500).json({
          success: false,
          message: 'File upload succeeded but metadata is invalid'
        })
      }

      finalImageUrl = fileMetadata.url
    } else if (!imageUrl || !imageUrl.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Banner image is required. Please upload an image or provide an image URL.'
      })
    } else {
      // Validate URL format
      try {
        new URL(imageUrl.trim())
        finalImageUrl = imageUrl.trim()
      } catch {
        return res.status(400).json({
          success: false,
          message: 'Invalid image URL format'
        })
      }
    }

    // Validate date range
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      if (start > end) {
        return res.status(400).json({
          success: false,
          message: 'Start date must be before or equal to end date'
        })
      }
    }

    // Get max order to place new banner at end
    const maxOrder = await Banner.findOne().sort({ order: -1 }).select('order').lean()
    const newOrder = order !== undefined ? parseInt(order) : (maxOrder?.order || 0) + 1

    // Get max priority
    const maxPriority = await Banner.findOne().sort({ priority: -1 }).select('priority').lean()
    const newPriority = priority !== undefined ? parseInt(priority) : (maxPriority?.priority || 0) + 1

    // Create banner document
    const banner = new Banner({
      title,
      subtitle: subtitle || '',
      description: description || '',
      imageUrl: finalImageUrl,
      link,
      offerText: offerText || '',
      order: newOrder,
      priority: newPriority,
      isActive: isActive !== undefined ? (isActive === 'true' || isActive === true) : true,
      startDate: (startDate && startDate.trim() !== '') ? new Date(startDate) : null,
      endDate: (endDate && endDate.trim() !== '') ? new Date(endDate) : null
    })

    await banner.save()

    res.status(201).json({
      success: true,
      message: 'Banner created successfully',
      data: banner
    })
  } catch (error) {
    console.error('Create banner error:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create banner'
    })
  }
})

/**
 * PUT /api/admin/banners/:id
 * Update banner (admin only)
 */
router.put('/:id', verifyAdminToken, upload.single('image'), [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('subtitle').optional().trim(),
  body('description').optional().trim(),
  body('link').optional().trim().notEmpty().withMessage('Link cannot be empty').custom((value) => {
    if (!value) return true
    const isExternalUrl = value.startsWith('http://') || value.startsWith('https://')
    const isInternalRoute = value.startsWith('/')
    
    if (isExternalUrl) {
      try {
        new URL(value)
        return true
      } catch {
        throw new Error('Link must be a valid URL')
      }
    }
    
    if (isInternalRoute) {
      return true
    }
    
    throw new Error('Link must be a valid URL or internal route')
  }),
  body('offerText').optional().trim(),
  body('order').optional().isInt({ min: 0 }).withMessage('Order must be a non-negative integer'),
  body('priority').optional().isInt({ min: 0 }).withMessage('Priority must be a non-negative integer'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  body('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
  body('endDate').optional().isISO8601().withMessage('End date must be a valid ISO 8601 date')
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

    const { id } = req.params
    const banner = await Banner.findById(id)
    
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      })
    }

    const { title, subtitle, description, link, offerText, order, priority, isActive, startDate, endDate, imageUrl } = req.body
    const updateData = {}

    if (title !== undefined) updateData.title = title.trim()
    if (subtitle !== undefined) updateData.subtitle = subtitle.trim()
    if (description !== undefined) updateData.description = description.trim()
    if (link !== undefined) updateData.link = link.trim()
    if (offerText !== undefined) updateData.offerText = offerText.trim()
    if (order !== undefined) updateData.order = parseInt(order)
    if (priority !== undefined) updateData.priority = parseInt(priority)
    if (isActive !== undefined) updateData.isActive = isActive === 'true' || isActive === true
    
    // Handle date fields - handle empty strings from FormData
    if (startDate !== undefined) {
      updateData.startDate = (startDate && startDate.trim() !== '') ? new Date(startDate) : null
    }
    if (endDate !== undefined) {
      updateData.endDate = (endDate && endDate.trim() !== '') ? new Date(endDate) : null
    }
    
    // Validate date range if both are being updated
    if (updateData.startDate !== undefined && updateData.endDate !== undefined) {
      const start = updateData.startDate || banner.startDate
      const end = updateData.endDate || banner.endDate
      if (start && end && start > end) {
        return res.status(400).json({
          success: false,
          message: 'Start date must be before or equal to end date'
        })
      }
    } else if (updateData.startDate !== undefined && banner.endDate) {
      if (updateData.startDate > banner.endDate) {
        return res.status(400).json({
          success: false,
          message: 'Start date must be before or equal to end date'
        })
      }
    } else if (updateData.endDate !== undefined && banner.startDate) {
      if (banner.startDate > updateData.endDate) {
        return res.status(400).json({
          success: false,
          message: 'Start date must be before or equal to end date'
        })
      }
    }

    // Handle image update: file upload takes priority, then URL
    if (req.file) {
      let fileMetadata
      try {
        fileMetadata = await storeBannerImage(req.file)
      } catch (storageError) {
        console.error('Banner upload error:', storageError)
        return res.status(500).json({
          success: false,
          message: storageError.message || 'Failed to upload banner image'
        })
      }

      if (!fileMetadata || !fileMetadata.url) {
        return res.status(500).json({
          success: false,
          message: 'File upload succeeded but metadata is invalid'
        })
      }

      updateData.imageUrl = fileMetadata.url
    } else if (imageUrl && imageUrl.trim()) {
      // Validate URL format if provided
      try {
        new URL(imageUrl.trim())
        updateData.imageUrl = imageUrl.trim()
      } catch {
        return res.status(400).json({
          success: false,
          message: 'Invalid image URL format'
        })
      }
    }

    // Update banner
    const updatedBanner = await Banner.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    )

    res.json({
      success: true,
      message: 'Banner updated successfully',
      data: updatedBanner
    })
  } catch (error) {
    console.error('Update banner error:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update banner'
    })
  }
})

/**
 * PATCH /api/admin/banners/reorder
 * Reorder banners (admin only)
 */
router.patch('/reorder', verifyAdminToken, [
  body('bannerIds').isArray().withMessage('bannerIds must be an array'),
  body('bannerIds.*').isMongoId().withMessage('Each banner ID must be valid')
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

    const { bannerIds } = req.body

    // Update order for each banner based on array index
    const updatePromises = bannerIds.map((bannerId, index) => {
      return Banner.findByIdAndUpdate(
        bannerId,
        { $set: { order: index + 1 } },
        { new: true }
      )
    })

    await Promise.all(updatePromises)

    res.json({
      success: true,
      message: 'Banners reordered successfully'
    })
  } catch (error) {
    console.error('Reorder banners error:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to reorder banners'
    })
  }
})

/**
 * DELETE /api/admin/banners/:id
 * Delete banner (admin only)
 */
router.delete('/:id', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params

    const banner = await Banner.findById(id)
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      })
    }

    await Banner.findByIdAndDelete(id)

    res.json({
      success: true,
      message: 'Banner deleted successfully'
    })
  } catch (error) {
    console.error('Delete banner error:', error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete banner'
    })
  }
})

export default router

