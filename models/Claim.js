import mongoose from 'mongoose'

const claimSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true
  },
  items: [{
    orderItemId: String,
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    medicine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AllMedicine'
    },
    name: String,
    quantity: Number,
    price: Number
  }],
  reason: {
    type: String,
    enum: ['Wrong product', 'Damaged item', 'Item missing', 'Not delivered', 'Other'],
    required: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  images: [{
    url: String,
    publicId: String,
    filename: String
  }],
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'resolved'],
    default: 'pending',
    index: true
  },
  adminNote: {
    type: String,
    trim: true
  },
  resolvedAt: {
    type: Date
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true,
  collection: 'claims'
})

// Indexes for better query performance
claimSchema.index({ user: 1, createdAt: -1 })
claimSchema.index({ order: 1 })
claimSchema.index({ status: 1, createdAt: -1 })
claimSchema.index({ createdAt: -1 })

export default mongoose.model('Claim', claimSchema)

