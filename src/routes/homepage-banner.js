import express from 'express'
import HomePageBanner from '../../models/HomePageBanner.js'

const router = express.Router()

/**
 * GET /api/home-banner
 * Get active homepage banner (public)
 * Query param: bannerType (banner1 or banner2, defaults to banner1)
 */
router.get('/', async (req, res) => {
  try {
    const { bannerType = 'banner1' } = req.query
    const banner = await HomePageBanner.findOne({ isActive: true, bannerType })
      .sort({ createdAt: -1 })
      .select('_id bannerImage title subtitle description ctaLink cashbackPartnerLogos isActive bannerType createdAt updatedAt')
      .lean()

    if (!banner) {
      return res.json({
        success: true,
        data: null,
        message: `No active homepage banner found for type ${bannerType}`
      })
    }

    res.json({
      success: true,
      data: banner
    })
  } catch (error) {
    console.error('Get homepage banner error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch homepage banner'
    })
  }
})

export default router

