import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import morgan from 'morgan'
import mongoose from 'mongoose'
import { auth } from './src/middleware/auth.js'
import rateLimit from 'express-rate-limit'
import compression from 'compression'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { connectDB } from './src/db.js'
import authRoutes from './src/routes/auth.js'
import adminAuthRoutes from './src/routes/adminAuth.js'
import prescriptionRoutes from './src/routes/prescriptions.js'
import cartRoutes from './src/routes/cart.js'
import orderRoutes from './src/routes/orders.js'
import productRoutes from './routes/products.js'
import allMedicineRoutes from './routes/allmedecine.js'
import searchRoutes from './routes/search.js'
import adminProductRoutes from './src/routes/admin/products.js'
import adminUserRoutes from './src/routes/admin/users.js'
import adminOrderRoutes from './src/routes/admin/orders.js'
import adminPrescriptionRoutes from './src/routes/admin/prescriptions.js'
import profileRoutes from './routes/profile.js'
dotenv.config()

// Global error handlers to prevent Vercel crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason)
})

// Initialize Express app
const app = express()

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts for better performance
  crossOriginEmbedderPolicy: false
}))

// Compression middleware - compress all responses
app.use(compression({
  level: 6, // Compression level (1-9, 6 is good balance)
  filter: (req, res) => {
    // Don't compress if client doesn't support it
    if (req.headers['x-no-compression']) {
      return false
    }
    // Use compression for all text-based responses
    return compression.filter(req, res)
  }
}))

// CORS configuration - optimized for Vercel and mobile browsers
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://medical-shop-frontend.vercel.app",
  /^https:\/\/.*\.vercel\.app$/, // Allow all Vercel deployments
  /^https:\/\/.*\.netlify\.app$/, // Allow Netlify deployments
  process.env.FRONTEND_URL,
  process.env.FRONTEND_BASE_URL
].filter(Boolean); // Remove undefined values

app.use(cors({
  origin: (origin, callback) => {
    // Always allow requests with no origin (mobile apps, Postman, curl, etc.)
    // This is important for mobile browsers and some mobile apps
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin matches any allowed pattern
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return origin === allowed || origin.startsWith(allowed);
      }
      if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return false;
    });

    // In production/Vercel, always allow for better mobile compatibility
    // This ensures mobile browsers work correctly
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      return callback(null, true);
    }

    // In development, be more strict
    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn("CORS: Blocked origin in development:", origin);
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  exposedHeaders: ["Content-Range", "X-Content-Range"],
  maxAge: 86400, // 24 hours preflight cache
  optionsSuccessStatus: 200 // Some mobile browsers need this
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
})

app.use('/api/', limiter)

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
})

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Serve static files from uploads directory (only in development)
// On Vercel/production, use Cloudinary instead
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)
  app.use('/uploads', express.static(join(__dirname, 'uploads')))
  console.log('📁 Static file serving enabled for local development')
} else {
  console.log('☁️  Using Cloudinary for file storage (production mode)')
}

// Performance monitoring middleware
const performanceMonitor = (req, res, next) => {
  const start = Date.now()
  
  res.on('finish', () => {
    const duration = Date.now() - start
    const { method, url } = req
    const { statusCode } = res
    
    // Log slow requests (>300ms)
    if (duration > 300) {
      console.warn(`⚠️  Slow Request: ${method} ${url} - ${duration}ms - Status: ${statusCode}`)
    }
    
    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 ${method} ${url} - ${duration}ms - Status: ${statusCode}`)
    }
  })
  
  next()
}

app.use(performanceMonitor)

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'))
}

// Health check endpoint with caching headers
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  
  // Set cache headers (no cache for health check)
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  })
  
  res.json({ 
    status: 'OK',
    database: dbStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  })
})

// API health check endpoint with caching headers
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  
  // Set cache headers (no cache for health check)
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  })
  
  res.json({
    status: 'OK',
    database: dbStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
})

// Initialize MongoDB connection BEFORE routes
const mongoUrl = process.env.MONGO_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/medical-shop'

// Initialize database connection
const initializeDB = async () => {
  if (!mongoUrl) {
    console.error('❌ MongoDB connection string not found. Set MONGO_URL or MONGODB_URI in .env file')
    return
  }

  // Check if already connected (Vercel serverless reuse)
  if (mongoose.connection.readyState === 1) {
    console.log('✅ MongoDB Already Connected (Reused)')
    console.log(`📊 Database: ${mongoose.connection.name}`)
    return
  }

  console.log('🔄 Connecting to MongoDB...')
  console.log(`📍 Connection URL: ${mongoUrl.replace(/:[^:@]+@/, ':****@')}`) // Hide password in logs
  try {
    await connectDB(mongoUrl)
    console.log('✅ MongoDB connected successfully - All routes ready')
    console.log(`📊 Database: ${mongoose.connection.name}`)
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB:', err.message)
    console.error('💡 Troubleshooting tips:')
    console.error('   1. Verify MONGO_URL or MONGODB_URI is set correctly in .env file')
    console.error('   2. Check MongoDB Atlas Network Access - whitelist your IP address')
    console.error('   3. Verify username and password are correct')
    console.error('   4. Ensure MongoDB Atlas cluster is running and accessible')
    // Don't exit in serverless environment
    if (!process.env.VERCEL) {
      console.error('⚠️  Server will start but database operations may fail')
      console.error('⚠️  Retrying connection in background...')
    }
  }
}

// Start DB connection (fire and forget, but wait a bit)
// Skip in Vercel serverless - api/index.js handles DB connection per-request
if (!process.env.VERCEL) {
  initializeDB().catch((err) => {
    console.error('Failed to initialize database:', err)
  })
}

// API routes
app.use('/api/auth', authLimiter, authRoutes)
console.log('✅ Auth routes registered at /api/auth')
app.use('/api/admin/auth', authLimiter, adminAuthRoutes)
console.log('✅ Admin auth routes registered at /api/admin/auth')
app.use('/api/products', productRoutes)
app.use('/api/allmedecine', allMedicineRoutes)
app.use('/api/search', searchRoutes)
app.use('/api/prescriptions', auth, prescriptionRoutes)
app.use('/api/cart', auth, cartRoutes)
app.use('/api/orders', auth, orderRoutes)
app.use('/api/profile', auth, profileRoutes)
app.use('/api/admin/products', adminProductRoutes)
app.use('/api/admin/users', adminUserRoutes)
app.use('/api/admin/orders', adminOrderRoutes)
app.use('/api/admin/prescriptions', adminPrescriptionRoutes)

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

// Redis connection (optional) - lazy loaded
let redisClient = null
let redisInitialized = false

const initRedis = async () => {
  if (redisInitialized) return redisClient
  redisInitialized = true
  
  if (process.env.REDIS_URL) {
    try {
      const { createClient } = await import('redis')
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
  
  return redisClient
}

// Initialize Redis in the background (fire and forget)
initRedis().catch(console.error)

// Export Redis client for use in other modules
app.redisClient = redisClient

// Export app for testing
export default app

// Start server if not in test environment
// Check if this is the main module (simplified ES module check)
const currentFilename = fileURLToPath(import.meta.url)
const isMainModule = process.argv[1] && currentFilename === process.argv[1]

// Only start server if running directly (not imported)
if (isMainModule && process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 4000
  
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`)
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
    console.log(`📋 API Base URL: http://localhost:${PORT}/api`)
  })
}


