import mongoose from 'mongoose'

const { Schema } = mongoose

const AllMedicineSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    trim: true,
    default: ''
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  mrp: {
    type: Number,
    min: 0
  },
  image: {
    type: String,
    trim: true,
    default: ''
  },
  images: [{
    type: String,
    trim: true
  }],
  tags: [{
    type: String,
    trim: true
  }],
  productRef: {
    type: Schema.Types.ObjectId,
    ref: 'Product'
  },
  slug: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'all_medicine'
})

export default mongoose.models.AllMedicine || mongoose.model('AllMedicine', AllMedicineSchema)

