import mongoose from 'mongoose'

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
    enum: ['USER', 'ADMIN'],
    default: 'USER'
  },
  isVerified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  collection: 'users'
})

// Method to get public profile
userSchema.methods.toJSON = function() {
  const user = this.toObject()
  delete user.__v
  return user
}

export default mongoose.model('User', userSchema)




