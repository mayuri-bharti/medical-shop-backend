import mongoose from 'mongoose'

const adminSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  isAdmin: {
    type: Boolean,
    default: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    sparse: true
  }
}, {
  timestamps: true,
  collection: 'admins'
})

// Method to get public profile
adminSchema.methods.toJSON = function() {
  const admin = this.toObject()
  delete admin.__v
  return admin
}

export default mongoose.model('Admin', adminSchema)



















