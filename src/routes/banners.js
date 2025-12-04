import express from 'express'
import Banner from '../../models/Banner.js'

const router = express.Router()

/**
 * GET /api/banners
 * Get all active banners filtered by date (public endpoint)
 */
router.get('/', async (req, res) => {
  try {
    const now = new Date()
    
    // Build query for active banners within date range
    const query = {
      isActive: true,
      $or: [
        // Banner has no date restrictions
        { startDate: null, endDate: null },
        // Banner has only start date and it's passed
        { startDate: { $lte: now }, endDate: null },
        // Banner has only end date and it hasn't passed
        { startDate: null, endDate: { $gte: now } },
        // Banner has both dates and current date is within range
        { startDate: { $lte: now }, endDate: { $gte: now } }
      ]
    }

    const banners = await Banner.find(query)
      .sort({ priority: -1, order: 1, createdAt: -1 })
      .select('_id title subtitle description imageUrl link offerText order priority startDate endDate')
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
        description: banner.description || '',
        imageUrl,
        link: banner.link,
        offerText: banner.offerText || '',
        order: banner.order,
        priority: banner.priority || 0
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

