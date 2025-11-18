import mongoose from 'mongoose'

const AvailabilitySchema = new mongoose.Schema(
  {
    dayOfWeek: {
      type: Number,
      min: 0,
      max: 6,
      required: true
    },
    slots: {
      type: [String],
      default: []
    },
    mode: {
      type: String,
      enum: ['in-person', 'video', 'phone', 'hybrid'],
      default: 'in-person'
    },
    locationLabel: {
      type: String,
      default: 'Primary Clinic'
    }
  },
  { _id: false }
)

const LocationSchema = new mongoose.Schema(
  {
    label: { type: String, default: 'Clinic' },
    city: { type: String, required: true },
    address: { type: String, required: true },
    pinCode: { type: String }
  },
  { _id: false }
)

const DoctorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    specialty: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    subSpecialty: {
      type: String,
      trim: true
    },
    experienceYears: {
      type: Number,
      default: 1
    },
    consultationFee: {
      type: Number,
      default: 499
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 4.5
    },
    languages: {
      type: [String],
      default: []
    },
    qualifications: {
      type: [String],
      default: []
    },
    hospitals: {
      type: [String],
      default: []
    },
    bio: {
      type: String,
      default: ''
    },
    avatarUrl: {
      type: String,
      default: ''
    },
    tags: {
      type: [String],
      default: []
    },
    locations: {
      type: [LocationSchema],
      default: []
    },
    availability: {
      type: [AvailabilitySchema],
      default: []
    },
    modes: {
      type: [String],
      enum: ['in-person', 'video', 'phone', 'hybrid'],
      default: ['in-person']
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
)

DoctorSchema.index({ name: 'text', specialty: 'text', subSpecialty: 'text' })

const Doctor = mongoose.models.Doctor || mongoose.model('Doctor', DoctorSchema)

export default Doctor

