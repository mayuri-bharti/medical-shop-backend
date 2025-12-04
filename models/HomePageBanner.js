import mongoose from 'mongoose'

const homePageBannerSchema = new mongoose.Schema({
  bannerImage: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  subtitle: {
    type: String,
    trim: true,
    default: ''
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  ctaLink: {
    type: String,
    required: true,
    trim: true
  },
  cashbackPartnerLogos: {
    type: [String],
    default: []
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  bannerType: {
    type: String,
    enum: ['banner1', 'banner2'],
    default: 'banner1',
    index: true
  }
}, {
  timestamps: true,
  collection: 'homepagebanners'
})

// Index for active banner queries
homePageBannerSchema.index({ isActive: 1, bannerType: 1, createdAt: -1 })

export default mongoose.model('HomePageBanner', homePageBannerSchema)

