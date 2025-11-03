import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import morgan from 'morgan'
import mongoose from 'mongoose'
import { auth } from './middleware/auth.js'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { connectDB } from './db.js'
import authRoutes from './routes/auth.js'
import prescriptionRoutes from './routes/prescriptions.js'
import cartRoutes from './routes/cart.js'
import orderRoutes from './routes/orders.js'
import productRoutes from '../routes/products.js'
import adminProductRoutes from './routes/admin/products.js'
dotenv.config()

// Global error handlers to prevent Vercel crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason)
})

// Initialize Express app
const app = express()

// Security middleware
app.use(helmet())

// CORS configuration with origin allowlist
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://medical-shop-frontend-beryl.vercel.app"
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn("Blocked by CORS:", origin);
      // Don’t crash function — just deny gracefully
      return callback(null, false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));



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
app.use('/api/products', productRoutes)
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

// Global error handler (MUST be before 404 handler)
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

// 404 handler (MUST be last)
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false,
    message: 'Route not found' 
  })
})

// Connect to MongoDB (with connection reuse for serverless)
if (process.env.MONGO_URL) {
  // Check if already connected (Vercel serverless reuse)
  if (mongoose.connection.readyState === 1) {
    console.log('✅ MongoDB Already Connected (Reused)')
  } else {
    connectDB(process.env.MONGO_URL).catch(console.error)
  }
} else {
  console.error('❌ MONGO_URL environment variable is not set')
}

// Redis connection (optional)
let redisClient = null
if (process.env.REDIS_URL) {
  const { createClient } = await import('redis')
  try {
    redisClient = createClient({ 
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
export default app

// Start server if not in test environment
const __filename = fileURLToPath(import.meta.url)
const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`

if (isMainModule) {
  const PORT = process.env.PORT || 4000
  
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`)
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
    console.log(`📋 API Base URL: http://localhost:${PORT}/api`)
  })
}

