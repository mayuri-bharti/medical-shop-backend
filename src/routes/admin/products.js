import express from 'express'
import { body, validationResult } from 'express-validator'
import { verifyAdminToken } from '../../middleware/adminAuth.js'
import Product from '../../../models/Product.js'
import { clearCache } from '../../middleware/cache.js'

const router = express.Router()

/**
 * GET /admin/products
 * Get all products with pagination
 * Status codes: 200 (success), 403 (not admin), 500 (error)
 */
router.get('/', verifyAdminToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit

    const filter = {}
    
    // Search filter
    if (req.query.search) {
      filter.$text = { $search: req.query.search }
    }
    
    // Category filter
    if (req.query.category) {
      filter.category = req.query.category
    }

    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

    const total = await Product.countDocuments(filter)

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    })
  } catch (error) {
    console.error('Get admin products error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products'
    })
  }
})

/**
 * POST /admin/products
 * Create new product
 * Status codes: 201 (success), 400 (validation error), 403 (not admin), 500 (error)
 */
router.post('/', verifyAdminToken, [
  body('name').trim().notEmpty().withMessage('Product name is required'),
  body('brand').trim().notEmpty().withMessage('Brand is required'),
  body('sku').trim().notEmpty().withMessage('SKU is required').isUppercase().withMessage('SKU must be uppercase'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('mrp').isFloat({ min: 0 }).withMessage('MRP must be a positive number'),
  body('stock').isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('images').optional().isArray().withMessage('Images must be an array'),
  body('images.*').optional().isString().withMessage('Each image must be a string URL'),
  body('category').optional().isIn([
    'Prescription Medicines',
    'OTC Medicines',
    'Wellness Products',
    'Personal Care',
    'Health Supplements',
    'Baby Care',
    'Medical Devices',
    'Ayurvedic Products'
  ]).withMessage('Invalid category')
], async (req, res) => {
  try {
    // Check database connection
    const mongoose = await import('mongoose')
    if (mongoose.default.connection.readyState !== 1) {
      console.error('❌ Database not connected!')
      return res.status(503).json({
        success: false,
        message: 'Database connection unavailable. Please try again.'
      })
    }
    
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      })
    }

    // Ensure isActive is set to true for new products
    const productData = {
      ...req.body,
      isActive: req.body.isActive !== undefined ? req.body.isActive : true
    }
    
    console.log('📦 Creating product with data:', {
      name: productData.name,
      brand: productData.brand,
      sku: productData.sku,
      category: productData.category,
      isActive: productData.isActive,
      price: productData.price,
      mrp: productData.mrp,
      stock: productData.stock
    })
    
    // Check if SKU already exists
    const existingProduct = await Product.findOne({ sku: productData.sku })
    if (existingProduct) {
      console.warn('⚠️  Product with SKU already exists:', productData.sku)
      return res.status(400).json({
        success: false,
        message: 'Product with this SKU already exists',
        existingProduct: {
          id: existingProduct._id,
          name: existingProduct.name,
          sku: existingProduct.sku
        }
      })
    }
    
    const product = new Product(productData)
    const savedProduct = await product.save()
    
    // Verify product was saved by querying it back
    const verifiedProduct = await Product.findById(savedProduct._id)
    if (!verifiedProduct) {
      console.error('❌ Product save verification failed!')
      return res.status(500).json({
        success: false,
        message: 'Product was not saved to database. Please try again.'
      })
    }
    
    console.log('✅ Product saved to database:', {
      id: verifiedProduct._id,
      name: verifiedProduct.name,
      sku: verifiedProduct.sku,
      isActive: verifiedProduct.isActive,
      category: verifiedProduct.category
    })

    // Clear products cache so new product appears immediately
    await clearCache('cache:/api/products*').catch(err => {
      console.warn('Failed to clear cache:', err.message)
    })

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product
    })
  } catch (error) {
    console.error('Create product error:', error)
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Product with this SKU already exists'
      })
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create product'
    })
  }
})

/**
 * GET /admin/products/:id
 * Get single product by ID
 * Status codes: 200 (success), 403 (not admin), 404 (not found), 500 (error)
 */
router.get('/:id', verifyAdminToken, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      })
    }

    res.json({
      success: true,
      data: { product }
    })
  } catch (error) {
    console.error('Get product error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product'
    })
  }
})

/**
 * PUT /admin/products/:id
 * Update product
 * Status codes: 200 (success), 400 (validation error), 403 (not admin), 404 (not found), 500 (error)
 */
router.put('/:id', verifyAdminToken, [
  body('name').optional().trim().notEmpty().withMessage('Product name cannot be empty'),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('mrp').optional().isFloat({ min: 0 }).withMessage('MRP must be a positive number'),
  body('stock').optional().isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
  body('images').optional().isArray().withMessage('Images must be an array'),
  body('images.*').optional().isString().withMessage('Each image must be a string URL')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      })
    }

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

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: product
    })
  } catch (error) {
    console.error('Update product error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to update product'
    })
  }
})

/**
 * DELETE /admin/products/:id
 * Delete (soft delete) product
 * Status codes: 200 (success), 403 (not admin), 404 (not found), 500 (error)
 */
router.delete('/:id', verifyAdminToken, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    )

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      })
    }

    res.json({
      success: true,
      message: 'Product deleted successfully',
      data: product
    })
  } catch (error) {
    console.error('Delete product error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to delete product'
    })
  }
})

export default router

