import express from 'express'
import multer from 'multer'
import { body, validationResult } from 'express-validator'
import { verifyAdminToken } from '../../middleware/adminAuth.js'
import HomePageBanner from '../../../models/HomePageBanner.js'
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

// Configure multer for multiple cashback partner logos
const uploadMultiple = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB per logo
    files: 10 // Max 10 logos
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
 * GET /api/admin/home-banner
 * Get homepage banner (admin only)
 * Query param: bannerType (banner1 or banner2)
 */
router.get('/', verifyAdminToken, async (req, res) => {
  try {
    const { bannerType = 'banner1' } = req.query
    const banner = await HomePageBanner.findOne({ isActive: true, bannerType })
      .sort({ createdAt: -1 })

    res.json({
      success: true,
      data: banner || null
    })
  } catch (error) {
    console.error('Get homepage banner error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch homepage banner'
    })
  }
})

/**
 * POST /api/admin/home-banner
 * Create or update homepage banner (admin only)
 * Only one active banner at a time - if creating new, deactivate old ones
 */
router.post('/', verifyAdminToken, upload.fields([
  { name: 'bannerImage', maxCount: 1 },
  { name: 'cashbackPartnerLogos', maxCount: 10 }
]), [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('subtitle').optional().trim(),
  body('description').optional().trim(),
  body('ctaLink').trim().notEmpty().withMessage('CTA link is required'),
  body('bannerImageUrl').optional().trim(),
  body('cashbackPartnerLogosUrls').optional().custom((value) => {
    if (value === undefined || value === null || value === '') return true
    // Accept array
    if (Array.isArray(value)) return true
    // Accept JSON string that can be parsed to array
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value)
        return Array.isArray(parsed)
      } catch {
        return false
      }
    }
    return false
  }).withMessage('Cashback partner logos URLs must be an array or valid JSON array string'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  body('bannerType').optional().isIn(['banner1', 'banner2']).withMessage('Banner type must be banner1 or banner2')
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

    const { title, subtitle, description, ctaLink, bannerImageUrl, isActive } = req.body
    
    // Parse cashbackPartnerLogosUrls from FormData (can be array or string)
    let cashbackPartnerLogosUrls = req.body.cashbackPartnerLogosUrls
    if (typeof cashbackPartnerLogosUrls === 'string') {
      try {
        cashbackPartnerLogosUrls = JSON.parse(cashbackPartnerLogosUrls)
      } catch {
        // If not JSON, treat as single value or array
        cashbackPartnerLogosUrls = cashbackPartnerLogosUrls ? [cashbackPartnerLogosUrls] : []
      }
    }
    // Handle FormData array format: cashbackPartnerLogosUrls[0], cashbackPartnerLogosUrls[1], etc.
    if (!Array.isArray(cashbackPartnerLogosUrls)) {
      const urlArray = []
      let index = 0
      while (req.body[`cashbackPartnerLogosUrls[${index}]`]) {
        urlArray.push(req.body[`cashbackPartnerLogosUrls[${index}]`])
        index++
      }
      if (urlArray.length > 0) {
        cashbackPartnerLogosUrls = urlArray
      }
    }

    // Handle banner image upload
    let finalBannerImageUrl = bannerImageUrl

    if (req.files && req.files.bannerImage && req.files.bannerImage[0]) {
      try {
        const fileMetadata = await storeBannerImage(req.files.bannerImage[0])
        if (!fileMetadata || !fileMetadata.url) {
          return res.status(500).json({
            success: false,
            message: 'File upload succeeded but metadata is invalid'
          })
        }
        finalBannerImageUrl = fileMetadata.url
      } catch (storageError) {
        console.error('Banner image upload error:', storageError)
        return res.status(500).json({
          success: false,
          message: storageError.message || 'Failed to upload banner image'
        })
      }
    } else if (!bannerImageUrl || !bannerImageUrl.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Banner image is required. Please upload an image or provide an image URL.'
      })
    } else {
      // Validate URL format
      try {
        new URL(bannerImageUrl.trim())
        finalBannerImageUrl = bannerImageUrl.trim()
      } catch {
        return res.status(400).json({
          success: false,
          message: 'Invalid banner image URL format'
        })
      }
    }

    // Handle cashback partner logos uploads
    let finalCashbackLogos = []
    
    if (req.files && req.files.cashbackPartnerLogos && req.files.cashbackPartnerLogos.length > 0) {
      try {
        const uploadedLogos = await Promise.all(
          req.files.cashbackPartnerLogos.map(file => storeBannerImage(file))
        )
        finalCashbackLogos = uploadedLogos.map(meta => meta.url).filter(Boolean)
      } catch (storageError) {
        console.error('Cashback logos upload error:', storageError)
        return res.status(500).json({
          success: false,
          message: storageError.message || 'Failed to upload cashback partner logos'
        })
      }
    } else if (cashbackPartnerLogosUrls && Array.isArray(cashbackPartnerLogosUrls)) {
      // Validate all URLs
      for (const url of cashbackPartnerLogosUrls) {
        if (url && url.trim()) {
          try {
            new URL(url.trim())
            finalCashbackLogos.push(url.trim())
          } catch {
            return res.status(400).json({
              success: false,
              message: `Invalid cashback partner logo URL: ${url}`
            })
          }
        }
      }
    }

    // If creating a new active banner, deactivate all existing banners of the same type
    const shouldActivate = isActive !== false
    if (shouldActivate) {
      await HomePageBanner.updateMany(
        { isActive: true, bannerType },
        { $set: { isActive: false } }
      )
    }

    // Create new homepage banner
    const newBanner = new HomePageBanner({
      bannerImage: finalBannerImageUrl,
      title: title.trim(),
      subtitle: subtitle ? subtitle.trim() : '',
      description: description ? description.trim() : '',
      ctaLink: ctaLink.trim(),
      cashbackPartnerLogos: finalCashbackLogos,
      isActive: shouldActivate,
      bannerType
    })

    await newBanner.save()

    res.json({
      success: true,
      message: 'Homepage banner created successfully',
      data: newBanner
    })
  } catch (error) {
    console.error('Create homepage banner error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to create homepage banner',
      error: error.message
    })
  }
})

/**
 * PUT /api/admin/home-banner/:id
 * Update homepage banner (admin only)
 */
router.put('/:id', verifyAdminToken, upload.fields([
  { name: 'bannerImage', maxCount: 1 },
  { name: 'cashbackPartnerLogos', maxCount: 10 }
]), [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('subtitle').optional().trim(),
  body('description').optional().trim(),
  body('ctaLink').optional().trim().notEmpty().withMessage('CTA link cannot be empty'),
  body('bannerImageUrl').optional().trim(),
  body('cashbackPartnerLogosUrls').optional().custom((value) => {
    if (value === undefined || value === null || value === '') return true
    // Accept array
    if (Array.isArray(value)) return true
    // Accept JSON string that can be parsed to array
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value)
        return Array.isArray(parsed)
      } catch {
        return false
      }
    }
    return false
  }).withMessage('Cashback partner logos URLs must be an array or valid JSON array string'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  body('bannerType').optional().isIn(['banner1', 'banner2']).withMessage('Banner type must be banner1 or banner2')
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

    const banner = await HomePageBanner.findById(req.params.id)
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Homepage banner not found'
      })
    }

    const { title, subtitle, description, ctaLink, bannerImageUrl, isActive } = req.body
    
    // Parse cashbackPartnerLogosUrls from FormData (can be array or string)
    let cashbackPartnerLogosUrls = req.body.cashbackPartnerLogosUrls
    if (typeof cashbackPartnerLogosUrls === 'string') {
      try {
        cashbackPartnerLogosUrls = JSON.parse(cashbackPartnerLogosUrls)
      } catch {
        cashbackPartnerLogosUrls = cashbackPartnerLogosUrls ? [cashbackPartnerLogosUrls] : []
      }
    }
    // Handle FormData array format: cashbackPartnerLogosUrls[0], cashbackPartnerLogosUrls[1], etc.
    if (!Array.isArray(cashbackPartnerLogosUrls)) {
      const urlArray = []
      let index = 0
      while (req.body[`cashbackPartnerLogosUrls[${index}]`]) {
        urlArray.push(req.body[`cashbackPartnerLogosUrls[${index}]`])
        index++
      }
      if (urlArray.length > 0) {
        cashbackPartnerLogosUrls = urlArray
      }
    }
    
    const updateData = {}

    if (title !== undefined) updateData.title = title.trim()
    if (subtitle !== undefined) updateData.subtitle = subtitle.trim()
    if (description !== undefined) updateData.description = description.trim()
    if (ctaLink !== undefined) updateData.ctaLink = ctaLink.trim()
    if (isActive !== undefined) updateData.isActive = isActive
    if (bannerType !== undefined) updateData.bannerType = bannerType

    // Handle banner image update
    if (req.files && req.files.bannerImage && req.files.bannerImage[0]) {
      try {
        const fileMetadata = await storeBannerImage(req.files.bannerImage[0])
        if (!fileMetadata || !fileMetadata.url) {
          return res.status(500).json({
            success: false,
            message: 'File upload succeeded but metadata is invalid'
          })
        }
        updateData.bannerImage = fileMetadata.url
      } catch (storageError) {
        console.error('Banner image upload error:', storageError)
        return res.status(500).json({
          success: false,
          message: storageError.message || 'Failed to upload banner image'
        })
      }
    } else if (bannerImageUrl && bannerImageUrl.trim()) {
      try {
        new URL(bannerImageUrl.trim())
        updateData.bannerImage = bannerImageUrl.trim()
      } catch {
        return res.status(400).json({
          success: false,
          message: 'Invalid banner image URL format'
        })
      }
    }

    // Handle cashback partner logos update
    if (req.files && req.files.cashbackPartnerLogos && req.files.cashbackPartnerLogos.length > 0) {
      try {
        const uploadedLogos = await Promise.all(
          req.files.cashbackPartnerLogos.map(file => storeBannerImage(file))
        )
        const newLogoUrls = uploadedLogos.map(meta => meta.url).filter(Boolean)
        // Merge with existing logos if URLs are also provided
        const existingLogos = banner.cashbackPartnerLogos || []
        const urlLogos = (cashbackPartnerLogosUrls && Array.isArray(cashbackPartnerLogosUrls)) 
          ? cashbackPartnerLogosUrls.filter(url => url && url.trim()).map(url => url.trim())
          : []
        updateData.cashbackPartnerLogos = [...newLogoUrls, ...urlLogos, ...existingLogos].filter((v, i, a) => a.indexOf(v) === i) // Remove duplicates
      } catch (storageError) {
        console.error('Cashback logos upload error:', storageError)
        return res.status(500).json({
          success: false,
          message: storageError.message || 'Failed to upload cashback partner logos'
        })
      }
    } else if (cashbackPartnerLogosUrls && Array.isArray(cashbackPartnerLogosUrls)) {
      // Validate all URLs
      const validUrls = []
      for (const url of cashbackPartnerLogosUrls) {
        if (url && url.trim()) {
          try {
            new URL(url.trim())
            validUrls.push(url.trim())
          } catch {
            return res.status(400).json({
              success: false,
              message: `Invalid cashback partner logo URL: ${url}`
            })
          }
        }
      }
      updateData.cashbackPartnerLogos = validUrls
    }

    // If activating this banner, deactivate all others of the same type
    const targetBannerType = updateData.bannerType || banner.bannerType
    if (updateData.isActive === true) {
      await HomePageBanner.updateMany(
        { _id: { $ne: req.params.id }, isActive: true, bannerType: targetBannerType },
        { $set: { isActive: false } }
      )
    }

    // Update banner
    const updatedBanner = await HomePageBanner.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    )

    res.json({
      success: true,
      message: 'Homepage banner updated successfully',
      data: updatedBanner
    })
  } catch (error) {
    console.error('Update homepage banner error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to update homepage banner',
      error: error.message
    })
  }
})

export default router

