import mongoose from 'mongoose'

const returnItemSchema = new mongoose.Schema({
  orderItem: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
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
  image: String
}, { _id: false })

const returnStatuses = [
  'pending',
  'approved',
  'rejected',
  'pickup_scheduled',
  'picked_up',
  'refund_processed',
  'completed',
  'cancelled'
]

const returnStatusHistorySchema = new mongoose.Schema({
  status: {
    type: String,
    enum: returnStatuses,
    required: true
  },
  note: String,
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'changedByModel'
  },
  changedByModel: {
    type: String,
    enum: ['User', 'Admin']
  },
  changedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false })

const returnSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  returnNumber: {
    type: String,
    unique: true,
    index: true
  },
  items: [returnItemSchema],
  reason: {
    type: String,
    required: true,
    enum: [
      'defective',
      'wrong_item',
      'damaged',
      'not_as_described',
      'expired',
      'other'
    ]
  },
  reasonDescription: {
    type: String,
    required: true,
    maxlength: 1000
  },
  refundAmount: {
    type: Number,
    required: true,
    min: 0
  },
  refundMethod: {
    type: String,
    enum: ['original', 'wallet', 'bank_transfer'],
    default: 'original'
  },
  status: {
    type: String,
    enum: returnStatuses,
    default: 'pending',
    index: true
  },
  statusHistory: {
    type: [returnStatusHistorySchema],
    default: []
  },
  pickupAddress: {
    name: String,
    phoneNumber: String,
    address: String,
    city: String,
    state: String,
    pincode: String,
    landmark: String
  },
  pickupDate: Date,
  pickupTimeSlot: String,
  trackingNumber: String,
  adminNotes: String,
  images: [String], // Images of damaged/defective items
  refundTransactionId: String,
  refundedAt: Date
}, {
  timestamps: true,
  collection: 'returns'
})

// Generate return number before saving
returnSchema.pre('save', async function(next) {
  if (!this.returnNumber) {
    const count = await this.constructor.countDocuments()
    this.returnNumber = `RET${String(count + 1).padStart(6, '0')}`
  }
  
  // Initialize status history if new
  if (this.isNew && (!this.statusHistory || this.statusHistory.length === 0)) {
    this.statusHistory = [{
      status: this.status || 'pending',
      changedAt: this.createdAt || new Date()
    }]
  }
  
  next()
})

// Indexes for better query performance
returnSchema.index({ user: 1, createdAt: -1 })
returnSchema.index({ order: 1 })
returnSchema.index({ status: 1, createdAt: -1 })
returnSchema.index({ returnNumber: 1 }, { unique: true })

// Method to update status
returnSchema.methods.updateStatus = async function(status, { changedBy, changedByModel, note } = {}) {
  const normalized = returnStatuses.find(
    (value) => value.toLowerCase() === String(status).toLowerCase()
  )

  if (!normalized) {
    throw new Error(`Invalid return status: ${status}`)
  }

  this.status = normalized

  const historyEntry = {
    status: normalized,
    changedBy,
    changedByModel: changedByModel || 'Admin',
    note,
    changedAt: new Date()
  }

  this.statusHistory.push(historyEntry)

  return this.save()
}

// Method to calculate refund amount
returnSchema.methods.calculateRefund = function() {
  return this.items.reduce((total, item) => total + (item.price * item.quantity), 0)
}

export default mongoose.model('Return', returnSchema)












