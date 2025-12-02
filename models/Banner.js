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
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: true,
  collection: 'banners'
})

// Indexes for better query performance
bannerSchema.index({ isActive: 1, order: 1 }) // For active banners sorted by order
bannerSchema.index({ createdAt: -1 }) // For date sorting

export default mongoose.model('Banner', bannerSchema)

