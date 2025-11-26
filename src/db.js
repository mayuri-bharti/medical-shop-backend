import mongoose from 'mongoose'

let cachedMongoUrl = null
let reconnectTimeout = null
let isConnecting = false
const DEFAULT_LOCAL_MONGO_URL = process.env.MONGO_FALLBACK_URL ||
  process.env.LOCAL_MONGO_URL ||
  'mongodb://127.0.0.1:27017/medical-shop'
const NETWORK_ERROR_CODES = new Set(['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN'])
let connectionEventsBound = false

const maskMongoUrl = (url = '') => url.replace(/:[^:@/]+@/, ':****@')

const buildMongoUrlPriorityList = (primaryUrl) => {
  const urls = []

  if (cachedMongoUrl) {
    urls.push(cachedMongoUrl)
  }

  if (primaryUrl && primaryUrl !== cachedMongoUrl) {
    urls.push(primaryUrl)
  }

  if (DEFAULT_LOCAL_MONGO_URL) {
    urls.push(DEFAULT_LOCAL_MONGO_URL)
  }

  return [...new Set(urls.filter(Boolean))]
}

const isNetworkFailure = (error = {}) => {
  if (NETWORK_ERROR_CODES.has(error.code)) {
    return true
  }

  const message = (error.message || '').toLowerCase()
  return [
    'querysrv',
    'timed out',
    'timeout',
    'failed to connect',
    'getaddrinfo',
    'econnrefused',
    'dns'
  ].some(token => message.includes(token))
}

const shouldUseFallback = (error, nextUrl) => {
  if (!nextUrl || nextUrl !== DEFAULT_LOCAL_MONGO_URL) {
    return false
  }

  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    return false
  }

  return isNetworkFailure(error)
}

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

    const connectionOrder = buildMongoUrlPriorityList(mongoUrl)
    if (!connectionOrder.length) {
      throw new Error('MongoDB connection string not provided')
    }

    let lastError = null

    for (let idx = 0; idx < connectionOrder.length; idx++) {
      const candidateUrl = connectionOrder[idx]
      const nextUrl = connectionOrder[idx + 1]

      try {
        console.log('🔄 Attempting to connect to MongoDB...')
        console.log(`📍 Connection URL: ${maskMongoUrl(candidateUrl)}`)
        isConnecting = true
        const conn = await mongoose.connect(candidateUrl, options)
        isConnecting = false
        cachedMongoUrl = candidateUrl
        lastError = null

        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout)
          reconnectTimeout = null
        }
        
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`)
        console.log(`📊 Database: ${conn.connection.name}`)
        
        if (!connectionEventsBound) {
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

          connectionEventsBound = true
        }
    
        return conn
      } catch (attemptError) {
        isConnecting = false
        lastError = attemptError

        if (shouldUseFallback(attemptError, nextUrl)) {
          console.warn(`⚠️  MongoDB primary unavailable (${attemptError.code || attemptError.message}). Falling back to ${maskMongoUrl(nextUrl)}`)
          continue
        }

        throw attemptError
      }
    }

    if (lastError) {
      throw lastError
    }
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


