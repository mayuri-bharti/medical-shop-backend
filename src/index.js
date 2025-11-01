const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const morgan = require('morgan')
const { auth } = require('./middleware/auth')
const rateLimit = require('express-rate-limit')
require('dotenv').config()

const { connectDB } = require('./db')
const authRoutes = require('./routes/auth')
const prescriptionRoutes = require('./routes/prescriptions')
const cartRoutes = require('./routes/cart')
const orderRoutes = require('./routes/orders')
const adminProductRoutes = require('./routes/admin/products')

// Initialize Express app
const app = express()

// Security middleware
app.use(helmet())

// CORS configuration with origin allowlist
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:5173']

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true)
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
})

app.use('/api/', limiter)

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true
})

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'))
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  })
})

// API routes
app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/prescriptions', auth, prescriptionRoutes)
app.use('/api/cart', auth, cartRoutes)
app.use('/api/orders', auth, orderRoutes)
app.use('/api/admin/products', auth, adminProductRoutes)

// Default route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Medical Shop API',
    version: '1.0.0',
    documentation: '/api/docs'
  })
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false,
    message: 'Route not found' 
  })
})

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err)
  
  // CORS error
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ 
      success: false,
      message: 'Not allowed by CORS' 
    })
  }
  
  // Default error
  res.status(err.status || 500).json({ 
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
})

// Connect to MongoDB
if (process.env.MONGO_URL) {
  connectDB(process.env.MONGO_URL).catch(console.error)
} else {
  console.error('❌ MONGO_URL environment variable is not set')
}

// Redis connection (optional)
let redisClient = null
if (process.env.REDIS_URL) {
  const redis = require('redis')
  try {
    redisClient = redis.createClient({ 
      url: process.env.REDIS_URL 
    })
    
    redisClient.on('error', (err) => {
      console.warn('⚠️  Redis Client Error:', err.message)
      console.log('📌 Continuing without Redis cache')
      redisClient = null
    })
    
    redisClient.on('connect', () => {
      console.log('✅ Redis Connected')
    })
    
    redisClient.connect().catch((err) => {
      console.warn('⚠️  Could not connect to Redis:', err.message)
      console.log('📌 Continuing without Redis cache')
      redisClient = null
    })
  } catch (error) {
    console.error('Failed to connect to Redis:', error.message)
    console.log('⚠️  Continuing without Redis cache')
  }
}

// Export Redis client for use in other modules
app.redisClient = redisClient

// Export app for testing
module.exports = app

// Start server if not in test environment
if (require.main === module) {
  const PORT = process.env.PORT || 4000
  
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`)
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
    console.log(`📋 API Base URL: http://localhost:${PORT}/api`)
  })
}

