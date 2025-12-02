import express from 'express'
import Banner from '../../models/Banner.js'

const router = express.Router()

/**
 * GET /api/banners
 * Get all active banners (public endpoint)
 */
router.get('/', async (req, res) => {
  try {
    const banners = await Banner.find({ isActive: true })
      .sort({ order: 1, createdAt: -1 })
      .select('_id title subtitle imageUrl link offerText order')
      .lean()

    // Ensure imageUrl is a full URL if it's a local path and map _id to id
    const bannersWithFullUrls = banners.map(banner => {
      let imageUrl = banner.imageUrl
      if (imageUrl && imageUrl.startsWith('/uploads/')) {
        // If it's a local path, make it a full URL
        const baseUrl = process.env.FRONTEND_URL || 
                       process.env.BACKEND_URL || 
                       `${req.protocol}://${req.get('host')}`
        imageUrl = `${baseUrl}${imageUrl}`
      }
      return {
        id: banner._id.toString(),
        title: banner.title,
        subtitle: banner.subtitle || '',
        imageUrl,
        link: banner.link,
        offerText: banner.offerText || '',
        order: banner.order
      }
    })

    res.json({
      success: true,
      data: bannersWithFullUrls
    })
  } catch (error) {
    console.error('Get banners error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch banners'
    })
  }
})

export default router

