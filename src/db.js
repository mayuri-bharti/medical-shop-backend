import mongoose from 'mongoose'

/**
 * Connect to MongoDB
 * @param {string} mongoUrl - MongoDB connection URL
 * @returns {Promise<mongoose.Connection>}
 */
export const connectDB = async (mongoUrl) => {
  try {
    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    }

    const conn = await mongoose.connect(mongoUrl, options)
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`)
    console.log(`📊 Database: ${conn.connection.name}`)
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err)
    })

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB disconnected')
    })

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close()
      console.log('MongoDB connection closed through app termination')
      process.exit(0)
    })

    return conn
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message)
    // Don't exit in test or serverless environment
    if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
      process.exit(1)
    }
    throw error
  }
}

/**
 * Close MongoDB connection
 */
const disconnectDB = async () => {
  try {
    await mongoose.connection.close()
    console.log('MongoDB connection closed')
  } catch (error) {
    console.error('Error closing MongoDB connection:', error.message)
  }
}

export { disconnectDB }


