const express = require('express')
const { body, validationResult, query } = require('express-validator')
const Product = require('../models/Product')
const { auth, adminAuth } = require('../middleware/auth')

const router = express.Router()

// Get all products with filtering and pagination
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('category').optional().isString(),
  query('search').optional().isString(),
  query('sort').optional().isIn(['name', 'price_asc', 'price_desc', 'rating', 'created'])
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array()
      })
    }

    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit
    const { category, search, sort } = req.query

    // Build filter
    const filter = { isActive: true }
    
    if (category) {
      filter.category = category
    }
    
    if (search) {
      filter.$text = { $search: search }
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
          sortBy = { 'rating.average': -1 }
          break
        case 'created':
          sortBy = { createdAt: -1 }
          break
      }
    }

    const products = await Product.find(filter)
      .sort(sortBy)
      .skip(skip)
      .limit(limit)
      .select('-__v')

    const total = await Product.countDocuments(filter)

    res.json({
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
    res.status(500).json({ message: 'Failed to fetch products' })
  }
})

// Get single product
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
    
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

    res.status(201).json(product)
  } catch (error) {
    console.error('Create product error:', error)
    res.status(500).json({ message: 'Failed to create product' })
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
      return res.status(404).json({ message: 'Product not found' })
    }

    res.json(product)
  } catch (error) {
    console.error('Update product error:', error)
    res.status(500).json({ message: 'Failed to update product' })
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

    res.json({ message: 'Product deleted successfully' })
  } catch (error) {
    console.error('Delete product error:', error)
    res.status(500).json({ message: 'Failed to delete product' })
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

module.exports = router




