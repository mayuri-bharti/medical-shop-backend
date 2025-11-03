const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const helmet = require('helmet')
const compression = require('compression')
const morgan = require('morgan')
const cookieParser = require('cookie-parser')
const rateLimit = require('express-rate-limit')
require('dotenv').config()

const app = express()

// Security middleware
app.use(helmet())
app.use(compression())

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
})
app.use('/api/', limiter)

// CORS configuration
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'https://medical-shop-frontend-beryl.vercel.app'
  ],
  credentials: true
}))


// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(cookieParser())

// Logging
app.use(morgan('combined'))

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medical-shop',
  'mongodb+srv://devmayuribharti_db_user:MayuriBharti%40123@cluster0.l0uj59m.mongodb.net/medical-shop'

)
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err))

// Routes - using src/routes for auth with OTP service
app.use('/api/auth', require('./src/routes/auth'))
app.use('/api/products', require('./routes/products'))
app.use('/api/cart', require('./routes/cart'))
app.use('/api/orders', require('./routes/orders'))
app.use('/api/prescriptions', require('./routes/prescriptions'))
app.use('/api/profile', require('./routes/profile'))

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  })
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' })
})

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
})




