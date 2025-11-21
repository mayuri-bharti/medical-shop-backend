import mongoose from 'mongoose'

const contactStatuses = ['new', 'in_progress', 'resolved', 'closed']

const contactMessageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: contactStatuses,
    default: 'new',
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  source: {
    type: String,
    default: 'contact_page'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  resolutionNotes: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  respondedAt: Date,
  metadata: {
    ip: String,
    userAgent: String
  }
}, {
  timestamps: true,
  collection: 'contact_messages'
})

contactMessageSchema.index({ createdAt: -1 })
contactMessageSchema.index({ email: 1 })
contactMessageSchema.index({ name: 'text', email: 'text', message: 'text' })

export const CONTACT_STATUSES = contactStatuses

export default mongoose.model('ContactMessage', contactMessageSchema)












