import mongoose from 'mongoose'

const AppointmentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
      index: true
    },
    doctorSnapshot: {
      name: String,
      specialty: String,
      consultationFee: Number
    },
    mode: {
      type: String,
      enum: ['in-person', 'video', 'phone', 'hybrid'],
      default: 'in-person'
    },
    locationLabel: {
      type: String,
      default: ''
    },
    date: {
      type: Date,
      required: true,
      index: true
    },
    slot: {
      type: String,
      required: true
    },
    reason: {
      type: String,
      trim: true,
      default: ''
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'completed', 'cancelled'],
      default: 'pending',
      index: true
    },
    notes: String,
    cancellationNote: String,
    createdBy: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user'
    }
  },
  { timestamps: true }
)

AppointmentSchema.index(
  { doctor: 1, date: 1, slot: 1 },
  { unique: true, partialFilterExpression: { status: { $ne: 'cancelled' } } }
)

const Appointment = mongoose.models.Appointment || mongoose.model('Appointment', AppointmentSchema)

export default Appointment

