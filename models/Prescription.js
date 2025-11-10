import mongoose from 'mongoose'

const prescriptionStatuses = [
  'submitted',
  'in_review',
  'approved',
  'rejected',
  'ordered',
  'fulfilled',
  'delivered',
  'cancelled'
]

const timelineFieldsByStatus = {
  submitted: 'submittedAt',
  in_review: 'reviewedAt',
  approved: 'approvedAt',
  rejected: 'rejectedAt',
  ordered: 'orderedAt',
  fulfilled: 'fulfilledAt',
  delivered: 'deliveredAt',
  cancelled: 'cancelledAt'
}

const statusHistorySchema = new mongoose.Schema({
  status: {
    type: String,
    enum: prescriptionStatuses,
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

const prescriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  fileUrl: {
    type: String,
    required: true
  },
  cloudinaryPublicId: {
    type: String,
    // Store Cloudinary public ID for deletion
  },
  fileType: {
    type: String,
    required: true,
    enum: ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
  },
  fileSize: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: prescriptionStatuses,
    default: 'submitted',
    index: true
  },
  doctorName: {
    type: String,
    trim: true
  },
  patientName: {
    type: String,
    trim: true
  },
  prescriptionDate: {
    type: Date
  },
  notes: {
    type: String
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  processedAt: {
    type: Date
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  pharmacistNotes: {
    type: String,
    trim: true
  },
  extractedMedicines: [{
    name: String,
    dosage: String,
    frequency: String,
    duration: String,
    quantity: Number
  }],
  shippingAddressSnapshot: {
    name: String,
    phoneNumber: String,
    address: String,
    city: String,
    state: String,
    pincode: String,
    landmark: String
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  statusHistory: {
    type: [statusHistorySchema],
    default: []
  },
  timeline: {
    submittedAt: {
      type: Date,
      default: Date.now
    },
    reviewedAt: Date,
    approvedAt: Date,
    rejectedAt: Date,
    orderedAt: Date,
    fulfilledAt: Date,
    deliveredAt: Date,
    cancelledAt: Date
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
})

// Indexes
prescriptionSchema.index({ user: 1, createdAt: -1 })
prescriptionSchema.index({ status: 1 })
prescriptionSchema.index({ order: 1 })

// Virtual for file extension
prescriptionSchema.virtual('fileExtension').get(function() {
  return this.originalName.split('.').pop().toLowerCase()
})

prescriptionSchema.methods.recordStatusChange = async function({
  status,
  changedBy,
  note
}) {
  if (!prescriptionStatuses.includes(status)) {
    throw new Error(`Invalid prescription status: ${status}`)
  }

  const now = new Date()

  this.status = status

  if (changedBy) {
    this.processedBy = changedBy
    this.processedAt = now
  }

  if (note) {
    this.notes = note
  }

  const historyEntry = {
    status,
    note,
    changedBy,
    changedAt: now
  }

  this.statusHistory.push(historyEntry)

  const timelineField = timelineFieldsByStatus[status]
  if (timelineField && !this.timeline[timelineField]) {
    this.timeline[timelineField] = now
  }

  return this.save()
}

prescriptionSchema.methods.assignTo = async function(userId) {
  this.assignedTo = userId
  if (this.status === 'submitted') {
    await this.recordStatusChange({
      status: 'in_review',
      changedBy: userId,
      note: 'Prescription moved to review'
    })
    return this
  }
  return this.save()
}

prescriptionSchema.pre('save', function(next) {
  if (this.isNew) {
    if (!this.timeline) {
      this.timeline = {}
    }
    if (!this.timeline.submittedAt) {
      this.timeline.submittedAt = this.createdAt || new Date()
    }
    if (!Array.isArray(this.statusHistory) || this.statusHistory.length === 0) {
      this.statusHistory = [{
        status: this.status || 'submitted',
        changedAt: this.createdAt || new Date()
      }]
    }
  }
  next()
})

export default mongoose.model('Prescription', prescriptionSchema)
