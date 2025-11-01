const mongoose = require('mongoose')

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
productSchema.index({ name: 'text', brand: 'text', description: 'text' })
productSchema.index({ category: 1, isActive: 1 })
productSchema.index({ price: 1 })

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

module.exports = mongoose.model('Product', productSchema)
