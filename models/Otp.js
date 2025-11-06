import mongoose from 'mongoose'

const otpSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  otpHash: {
    type: String,
    required: true
  },
  purpose: {
    type: String,
    enum: ['LOGIN', 'RESET', 'ADMIN_LOGIN'],
    default: 'LOGIN',
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 }
  },
  attempts: {
    type: Number,
    default: 0,
    max: 5
  },
  isUsed: {
    type: Boolean,
    default: false
  },
  sendCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  collection: 'otps'
})

// Index for efficient queries
otpSchema.index({ phone: 1, purpose: 1, createdAt: -1 })

// Method to increment attempts
otpSchema.methods.incrementAttempt = function() {
  this.attempts += 1
  return this.save()
}

// Method to mark as used
otpSchema.methods.markAsUsed = function() {
  this.isUsed = true
  return this.save()
}

export default mongoose.model('Otp', otpSchema)

