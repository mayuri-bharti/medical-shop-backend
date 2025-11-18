import express from 'express'
import { body, validationResult, query } from 'express-validator'
import mongoose from 'mongoose'
import Product from '../models/Product.js'
import { auth, adminAuth } from '../middleware/auth.js'
import { connectDB } from '../src/db.js'
import { cache, clearCache } from '../src/middleware/cache.js'

const router = express.Router()

/**
 * Controller: getAllProducts
 * Fetches all products from MongoDB with optional filtering and pagination
 * Route: GET /api/products
 */
const getAllProducts = async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      })
    }

    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit
    const { category, search, sort, brand } = req.query

    // Build filter - only show active products
    const filter = { isActive: true }
    
    if (category) {
      filter.category = category
    }
    
    if (brand) {
      filter.brand = { $regex: brand, $options: 'i' }
    }
    
    if (search) {
      // Use regex for search instead of text index (more reliable)
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ]
    }

    // Build sort
    let sortBy = { createdAt: -1 }
    if (sort) {
      switch (sort) {
        case 'name':
          sortBy = { name: 1 }
          break
        case 'price_asc':
          sortBy = { price: 1 }
          break
        case 'price_desc':
          sortBy = { price: -1 }
          break
        case 'rating':
          // Rating field doesn't exist in Product model, fallback to createdAt
          sortBy = { createdAt: -1 }
          break
        case 'created':
          sortBy = { createdAt: -1 }
          break
      }
    }

    // Ensure database connection (Vercel serverless might need connection on first request)
    if (mongoose.connection.readyState !== 1) {
      console.log('Database not connected, attempting to connect... ReadyState:', mongoose.connection.readyState)
      
      try {
        const mongoUrl = process.env.MONGO_URL || process.env.MONGODB_URI
        if (!mongoUrl) {
          console.error('❌ MongoDB connection string not found')
          return res.status(503).json({ 
            success: false,
            message: 'Database configuration error. Please contact support.' 
          })
        }
        
        // Check if connection is in progress (readyState 2 = connecting)
        if (mongoose.connection.readyState === 2) {
          // Wait for connection to complete
          await new Promise((resolve, reject) => {
            mongoose.connection.once('connected', resolve)
            mongoose.connection.once('error', reject)
            setTimeout(() => reject(new Error('Connection timeout')), 10000)
          })
        } else {
          // Try to connect
          await connectDB(mongoUrl)
        }
        
        // Wait for connection to be fully ready
        if (mongoose.connection.readyState !== 1) {
          throw new Error('Connection not ready after connect attempt')
        }
        
        console.log('✅ Database connected successfully')
      } catch (dbError) {
        console.error('❌ Failed to connect to database:', dbError.message)
        return res.status(503).json({ 
          success: false,
          message: 'Database connection unavailable. Please try again in a moment.' 
        })
      }
    }

    // Fetch products from MongoDB
    const products = await Product.find(filter)
      .sort(sortBy)
      .skip(skip)
      .limit(limit)
      .select('-__v')
      .lean() // Use lean() for better performance on Vercel

    const total = await Product.countDocuments(filter)

    // Log successful response (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log(`Successfully fetched ${products.length} products (page ${page}, total: ${total})`)
    }

    res.json({
      success: true,
      products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Get products error:', error)
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    })
    
    // Provide more detailed error information
    const errorMessage = error.message || 'Failed to fetch products'
    
    res.status(500).json({ 
      success: false,
      message: errorMessage,
      ...(process.env.NODE_ENV === 'development' && { 
        error: error.stack,
        details: error 
      })
    })
  }
}

// Get all products with filtering and pagination
// Cache for 60 seconds (1 minute)
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('category').optional().isString(),
  query('brand').optional().isString(),
  query('search').optional().isString(),
  query('sort').optional().isIn(['name', 'price_asc', 'price_desc', 'rating', 'created'])
], cache(60), getAllProducts)

// Get single product - Cache for 5 minutes
router.get('/:id', cache(300), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .select('-__v')
      .lean() // Use lean for better performance
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    res.json(product)
  } catch (error) {
    console.error('Get product error:', error)
    res.status(500).json({ message: 'Failed to fetch product' })
  }
})

// Create product (Admin only)
router.post('/', adminAuth, [
  body('name').notEmpty().withMessage('Product name is required'),
  body('description').notEmpty().withMessage('Product description is required'),
  body('price').isNumeric().withMessage('Price must be a number'),
  body('category').isIn([
    'Prescription Medicines',
    'OTC Medicines',
    'Wellness Products',
    'Personal Care',
    'Health Supplements',
    'Baby Care',
    'Medical Devices',
    'Ayurvedic Products'
  ]).withMessage('Invalid category'),
  body('brand').notEmpty().withMessage('Brand is required'),
  body('stock').isInt({ min: 0 }).withMessage('Stock must be a non-negative integer')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array()
      })
    }

    const product = new Product(req.body)
    await product.save()

    // Clear products cache when new product is created
    await clearCache('cache:/api/products*')

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product
    })
  } catch (error) {
    console.error('Create product error:', error)
    res.status(500).json({ 
      success: false,
      message: 'Failed to create product' 
    })
  }
})

// Update product (Admin only)
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )

    if (!product) {
      return res.status(404).json({ 
        success: false,
        message: 'Product not found' 
      })
    }

    // Clear products cache when product is updated
    await clearCache('cache:/api/products*')

    res.json({
      success: true,
      message: 'Product updated successfully',
      product
    })
  } catch (error) {
    console.error('Update product error:', error)
    res.status(500).json({ 
      success: false,
      message: 'Failed to update product' 
    })
  }
})

// Delete product (Admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    )

    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }

    // Clear products cache when product is deleted
    await clearCache('cache:/api/products*')

    res.json({ 
      success: true,
      message: 'Product deleted successfully' 
    })
  } catch (error) {
    console.error('Delete product error:', error)
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete product' 
    })
  }
})

// Get product categories
router.get('/categories/list', async (req, res) => {
  try {
    const categories = [
      'Prescription Medicines',
      'OTC Medicines',
      'Wellness Products',
      'Personal Care',
      'Health Supplements',
      'Baby Care',
      'Medical Devices',
      'Ayurvedic Products'
    ]
    
    res.json(categories)
  } catch (error) {
    console.error('Get categories error:', error)
    res.status(500).json({ message: 'Failed to fetch categories' })
  }
})

export default router




