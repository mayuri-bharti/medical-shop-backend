import mongoose from 'mongoose'

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  brand: {
    type: String,
    required: true,
    trim: true
  },
  sku: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
    index: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  mrp: {
    type: Number,
    required: true,
    min: 0
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  images: [{
    type: String,
    required: true
  }],
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  category: {
    type: String,
    enum: [
      'Prescription Medicines',
      'OTC Medicines',
      'Wellness Products',
      'Personal Care',
      'Health Supplements',
      'Baby Care',
      'Medical Devices',
      'Ayurvedic Products'
    ]
  }
}, {
  timestamps: true,
  collection: 'products'
})

// Indexes for better query performance
// Text index for search (compound index for better performance)
productSchema.index({ name: 'text', brand: 'text', description: 'text' })

// Compound indexes for common queries
productSchema.index({ category: 1, isActive: 1, price: 1 }) // For category filtering with sorting
productSchema.index({ isActive: 1, createdAt: -1 }) // For active products sorted by date
productSchema.index({ isActive: 1, price: 1 }) // For price sorting
productSchema.index({ sku: 1 }, { unique: true }) // Unique index on SKU (already exists but explicit)
productSchema.index({ category: 1 }) // Single field index for category
productSchema.index({ price: 1 }) // Single field index for price

// Virtual for discount percentage
productSchema.virtual('discountPercentage').get(function() {
  if (this.mrp > 0 && this.price < this.mrp) {
    return Math.round(((this.mrp - this.price) / this.mrp) * 100)
  }
  return 0
})

// Method to check if product is in stock
productSchema.methods.isInStock = function() {
  return this.stock > 0 && this.isActive
}

// Method to reduce stock
productSchema.methods.reduceStock = function(quantity) {
  if (this.stock >= quantity) {
    this.stock -= quantity
    return true
  }
  return false
}

// Method to add stock
productSchema.methods.addStock = function(quantity) {
  this.stock += quantity
}

export default mongoose.model('Product', productSchema)
