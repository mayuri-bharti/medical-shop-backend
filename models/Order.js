import mongoose from 'mongoose'

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  name: {
    type: String,
    required: true
  },
  image: {
    type: String
  }
}, { _id: false })

const orderStatuses = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled'
]

const statusHistorySchema = new mongoose.Schema({
  status: {
    type: String,
    enum: orderStatuses,
    required: true
  },
  note: String,
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  changedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false })

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  items: [orderItemSchema],
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  deliveryFee: {
    type: Number,
    default: 0,
    min: 0
  },
  taxes: {
    type: Number,
    default: 0,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: orderStatuses,
    default: 'pending',
    index: true
  },
  shippingAddress: {
    name: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    landmark: String
  },
  trackingNumber: String,
  deliveryDate: Date,
  orderNumber: {
    type: String,
    unique: true,
    index: true
  },
  prescription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prescription'
  },
  source: {
    type: String,
    enum: ['catalog', 'prescription', 'manual'],
    default: 'catalog'
  },
  paymentMethod: {
    type: String,
    enum: ['cod', 'online', 'wallet'],
    default: 'cod'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  notes: {
    type: String
  },
  statusHistory: {
    type: [statusHistorySchema],
    default: []
  }
}, {
  timestamps: true,
  collection: 'orders'
})

// Generate order number before saving
orderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    const count = await this.constructor.countDocuments()
    this.orderNumber = `ORD${String(count + 1).padStart(6, '0')}`
  }
  next()
})

// Indexes for better query performance
orderSchema.index({ user: 1, createdAt: -1 }) // For user's orders
orderSchema.index({ status: 1, createdAt: -1 }) // For orders by status
orderSchema.index({ orderNumber: 1 }, { unique: true }) // Unique index on order number
orderSchema.index({ user: 1, status: 1 }) // Compound index for user orders by status
orderSchema.index({ createdAt: -1 }) // For recent orders
orderSchema.index({ prescription: 1 })

// Method to calculate total items
orderSchema.methods.getTotalItems = function() {
  return this.items.reduce((total, item) => total + item.quantity, 0)
}

// Method to update status
orderSchema.methods.updateStatus = async function(status, { changedBy, note } = {}) {
  if (!orderStatuses.includes(status)) {
    throw new Error(`Invalid order status: ${status}`)
  }

  this.status = status

  const historyEntry = {
    status,
    changedBy,
    note
  }

  this.statusHistory.push(historyEntry)

  return this.save()
}

// Method to cancel order
orderSchema.methods.cancelOrder = function(reason) {
  if (['pending', 'confirmed'].includes(this.status)) {
    this.status = 'cancelled'
    this.notes = reason ? `Cancelled: ${reason}` : 'Order cancelled'
    return this.save()
  }
  throw new Error('Cannot cancel order in current status')
}

orderSchema.pre('save', function(next) {
  if (this.isNew) {
    if (!Array.isArray(this.statusHistory) || this.statusHistory.length === 0) {
      this.statusHistory = [{
        status: this.status || 'pending',
        changedAt: this.createdAt || new Date()
      }]
    }
  }
  next()
})

export default mongoose.model('Order', orderSchema)
