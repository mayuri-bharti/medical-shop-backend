import mongoose from 'mongoose'
import { connectDB } from '../db.js'

const waitForExistingConnection = () => new Promise((resolve, reject) => {
  mongoose.connection.once('connected', resolve)
  mongoose.connection.once('error', reject)
  setTimeout(() => reject(new Error('MongoDB connection timeout')), 10000)
})

export const ensureDatabaseConnection = async () => {
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
    await waitForExistingConnection()
  }
}

export default ensureDatabaseConnection



