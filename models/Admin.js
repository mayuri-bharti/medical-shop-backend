import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

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
  },
  password: {
    type: String,
    select: false // Don't include password in queries by default
  },
  username: {
    type: String,
    trim: true,
    sparse: true,
    lowercase: true
  }
}, {
  timestamps: true,
  collection: 'admins'
})

// Hash password before saving
adminSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next()
  
  try {
    const salt = await bcrypt.genSalt(10)
    this.password = await bcrypt.hash(this.password, salt)
    next()
  } catch (error) {
    next(error)
  }
})

// Method to compare password
adminSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false
  return await bcrypt.compare(candidatePassword, this.password)
}

// Method to get public profile
adminSchema.methods.toJSON = function() {
  const admin = this.toObject()
  delete admin.__v
  delete admin.password
  return admin
}

export default mongoose.model('Admin', adminSchema)





















