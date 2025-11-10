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
    enum: ['Pending', 'Verified', 'Completed'],
    default: 'Pending'
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

// Method to update prescription status
prescriptionSchema.methods.updateStatus = function(processedBy, status, notes) {
  this.status = status
  this.processedBy = processedBy
  this.processedAt = new Date()
  if (notes) {
    this.notes = notes
  }
  return this.save()
}

export default mongoose.model('Prescription', prescriptionSchema)




