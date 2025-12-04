import mongoose from 'mongoose'

const bannerSchema = new mongoose.Schema({
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
  imageUrl: {
    type: String,
    required: true
  },
  link: {
    type: String,
    required: true,
    trim: true
  },
  offerText: {
    type: String,
    trim: true,
    default: ''
  },
  order: {
    type: Number,
    default: 0,
    index: true
  },
  priority: {
    type: Number,
    default: 0,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  startDate: {
    type: Date,
    default: null
  },
  endDate: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  collection: 'banners'
})

// Indexes for better query performance
bannerSchema.index({ isActive: 1, priority: -1, order: 1 }) // For active banners sorted by priority and order
bannerSchema.index({ startDate: 1, endDate: 1 }) // For date range queries
bannerSchema.index({ createdAt: -1 }) // For date sorting

export default mongoose.model('Banner', bannerSchema)

