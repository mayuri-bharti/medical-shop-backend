import mongoose from 'mongoose'

/**
 * Connect to MongoDB
 * @param {string} mongoUrl - MongoDB connection URL
 * @returns {Promise<mongoose.Connection>}
 */
export const connectDB = async (mongoUrl) => {
  try {
    // If already connected, return immediately
    if (mongoose.connection.readyState === 1) {
      console.log('✅ MongoDB Already Connected')
      return mongoose.connection
    }

    // Configure mongoose to fail fast if not connected
    mongoose.set('bufferCommands', false)
    // Enable strict mode
    mongoose.set('strictQuery', true)

    const options = {
      maxPoolSize: 10, // Maximum number of connections in pool
      minPoolSize: 2, // Minimum number of connections in pool
      serverSelectionTimeoutMS: 30000, // 30 seconds for Atlas
      socketTimeoutMS: 45000, // Socket timeout
      connectTimeoutMS: 30000, // Connection timeout
      maxIdleTimeMS: 30000, // Close connections after 30s of inactivity
      heartbeatFrequencyMS: 10000, // Check connection health every 10s
    }

    console.log('🔄 Attempting to connect to MongoDB...')
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
    
    // Provide helpful error messages
    if (error.message.includes('authentication')) {
      console.error('💡 Check your MongoDB username and password in the connection string')
    } else if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      console.error('💡 Connection timeout - Check your network connection and MongoDB Atlas IP whitelist')
      console.error('💡 Make sure your IP address is whitelisted in MongoDB Atlas Network Access')
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('DNS')) {
      console.error('💡 DNS error - Check if the MongoDB hostname is correct')
    } else if (error.message.includes('connection')) {
      console.error('💡 Connection failed - Verify MongoDB is running and accessible')
    }
    
    // Don't exit in test or serverless environment
    if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
      console.error('⚠️  Server will start but database operations may fail')
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


