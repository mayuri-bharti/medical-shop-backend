import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const addressSchema = new mongoose.Schema({
  label: {
    type: String,
    trim: true,
    default: 'Home'
  },
  name: {
    type: String,
    trim: true,
    required: true
  },
  phoneNumber: {
    type: String,
    trim: true,
    required: true
  },
  address: {
    type: String,
    trim: true,
    required: true
  },
  city: {
    type: String,
    trim: true,
    required: true
  },
  state: {
    type: String,
    trim: true,
    required: true
  },
  pincode: {
    type: String,
    trim: true,
    required: true
  },
  landmark: {
    type: String,
    trim: true
  },
  isDefault: {
    type: Boolean,
    default: false
  }
}, {
  _id: true,
  timestamps: true
})

const userSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: function() {
      // Phone is required only if user is not logging in with Google
      return !this.googleId
    },
    // Removed unique constraint to allow same phone with different emails
    // Phone can be same for different users as long as emails are different
    sparse: true,
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
  avatar: {
    type: String,
    trim: true
  },
  password: {
    type: String,
    select: false
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
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
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  addresses: {
    type: [addressSchema],
    default: []
  },
  defaultAddressId: {
    type: mongoose.Schema.Types.ObjectId
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

userSchema.methods.getPublicProfile = function() {
  const user = this.toObject({
    virtuals: true
  })
  delete user.password
  delete user.__v
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isVerified: user.isVerified,
    isBlocked: user.isBlocked,
    addresses: user.addresses || [],
    defaultAddressId: user.defaultAddressId || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  }
}

export default mongoose.model('User', userSchema)




