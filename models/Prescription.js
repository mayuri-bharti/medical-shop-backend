import mongoose from 'mongoose'

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
    enum: ['pending', 'processing', 'completed', 'rejected'],
    default: 'pending'
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
  extractedMedicines: [{
    name: String,
    dosage: String,
    frequency: String,
    duration: String,
    quantity: Number
  }],
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

// Virtual for file extension
prescriptionSchema.virtual('fileExtension').get(function() {
  return this.originalName.split('.').pop().toLowerCase()
})

// Method to mark as processed
prescriptionSchema.methods.markAsProcessed = function(processedBy, extractedMedicines) {
  this.status = 'completed'
  this.processedBy = processedBy
  this.processedAt = new Date()
  if (extractedMedicines) {
    this.extractedMedicines = extractedMedicines
  }
  return this.save()
}

// Method to reject prescription
prescriptionSchema.methods.reject = function(processedBy, reason) {
  this.status = 'rejected'
  this.processedBy = processedBy
  this.processedAt = new Date()
  this.notes = reason
  return this.save()
}

export default mongoose.model('Prescription', prescriptionSchema)




