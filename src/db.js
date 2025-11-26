import mongoose from 'mongoose'

let cachedMongoUrl = null
let reconnectTimeout = null
let isConnecting = false

/**
 * Connect to MongoDB
 * @param {string} mongoUrl - MongoDB connection URL
 * @returns {Promise<mongoose.Connection>}
 */
export async function connectDB (mongoUrl) {
  try {
    if (mongoUrl) {
      cachedMongoUrl = mongoUrl
    }

    if (isConnecting) {
      return mongoose.connection.asPromise()
    }

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
    isConnecting = true
    const conn = await mongoose.connect(cachedMongoUrl, options)
    isConnecting = false
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`)
    console.log(`📊 Database: ${conn.connection.name}`)
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err)
      scheduleReconnect()
    })

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB disconnected')
      scheduleReconnect()
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
    isConnecting = false
    scheduleReconnect()
    
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

const scheduleReconnect = () => {
  if (process.env.VERCEL) {
    // Vercel serverless cold starts handle fresh connections per request
    return
  }

  if (!cachedMongoUrl || reconnectTimeout) {
    return
  }

  reconnectTimeout = setTimeout(async () => {
    reconnectTimeout = null
    try {
      console.log('🔁 Attempting automatic MongoDB reconnection...')
      await connectDB(cachedMongoUrl)
    } catch (error) {
      console.error('❌ MongoDB reconnection attempt failed:', error.message)
      scheduleReconnect()
    }
  }, 5000)
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


