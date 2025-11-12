import mongoose from 'mongoose'
import AllMedicine from '../../models/AllMedicine.js'
import Product from '../../models/Product.js'
import { connectDB } from '../db.js'
import { normalizeSearchResult } from '../utils/normalizeSearchResult.js'

const ensureDatabaseConnection = async () => {
  if (mongoose.connection.readyState === 1) {
    return
  }

  const mongoUrl = process.env.MONGO_URL || process.env.MONGODB_URI

  if (!mongoUrl) {
    throw new Error('MongoDB connection string not configured')
  }

  if (mongoose.connection.readyState === 0) {
    await connectDB(mongoUrl)
    return
  }

  if (mongoose.connection.readyState === 2) {
    await new Promise((resolve, reject) => {
      mongoose.connection.once('connected', resolve)
      mongoose.connection.once('error', reject)
      setTimeout(() => reject(new Error('MongoDB connection timeout')), 10000)
    })
  }
}

export const searchCatalog = async (term) => {
  if (!term || !term.trim()) {
    return []
  }

  await ensureDatabaseConnection()

  const searchRegex = new RegExp(term.trim(), 'i')

  const [medicines, products] = await Promise.all([
    AllMedicine.find({
      name: { $regex: searchRegex },
      $or: [
        { isActive: { $exists: false } },
        { isActive: { $ne: false } }
      ]
    })
      .select('name price image images category manufacturer brand pack_size packSize type')
      .lean(),
    Product.find({
      isActive: true,
      name: { $regex: searchRegex }
    })
      .select('name price images category brand sku')
      .lean()
  ])

  const normalizedMedicines = medicines.map((medicine) =>
    normalizeSearchResult(medicine, 'medicine')
  )

  const normalizedProducts = products.map((product) =>
    normalizeSearchResult(product, 'product')
  )

  const combined = [...normalizedMedicines, ...normalizedProducts]

  combined.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

  return combined
}

export default {
  searchCatalog
}






