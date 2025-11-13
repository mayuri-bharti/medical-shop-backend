import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const userSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    sparse: true
  },
  password: {
    type: String,
    select: false
  },
  role: {
    type: String,
    enum: ['USER'], // SECURITY: Only USER role allowed - admins must be in Admin collection
    default: 'USER',
    immutable: true // Prevent role changes after creation
  },
  isVerified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  collection: 'users'
})

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next()
  
  try {
    const salt = await bcrypt.genSalt(10)
    this.password = await bcrypt.hash(this.password, salt)
    next()
  } catch (error) {
    next(error)
  }
})

// SECURITY: Always force role to USER (defense in depth)
// This ensures users can NEVER have ADMIN role, even if someone tries to set it
// Admins must be registered in the Admin collection, not the User collection
userSchema.pre('save', function(next) {
  // Always set role to USER, regardless of what was passed
  if (this.isNew || this.isModified('role')) {
    this.role = 'USER'
  }
  next()
})

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false
  return await bcrypt.compare(candidatePassword, this.password)
}

// Method to get public profile
userSchema.methods.toJSON = function() {
  const user = this.toObject()
  delete user.__v
  delete user.password
  return user
}

export default mongoose.model('User', userSchema)




