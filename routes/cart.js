const express = require('express')
const { body, validationResult } = require('express-validator')
const Cart = require('../models/Cart')
const Product = require('../models/Product')
const { auth } = require('../middleware/auth')

const router = express.Router()

// Get user's cart
router.get('/', auth, async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id }).populate('items.product')
    
    if (!cart) {
      cart = new Cart({ user: req.user._id })
      await cart.save()
    }

    res.json(cart)
  } catch (error) {
    console.error('Get cart error:', error)
    res.status(500).json({ message: 'Failed to fetch cart' })
  }
})

// Add item to cart
router.post('/items', auth, [
  body('productId').isMongoId().withMessage('Valid product ID is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array()
      })
    }

    const { productId, quantity } = req.body

    // Check if product exists and is available
    const product = await Product.findById(productId)
    if (!product || !product.isActive) {
      return res.status(404).json({ message: 'Product not found' })
    }

    if (!product.isInStock()) {
      return res.status(400).json({ message: 'Product is out of stock' })
    }

    // Get or create cart
    let cart = await Cart.findOne({ user: req.user._id })
    if (!cart) {
      cart = new Cart({ user: req.user._id })
    }

    // Add item to cart
    cart.addItem(productId, quantity, product.price)
    await cart.save()

    // Populate product details
    await cart.populate('items.product')

    res.json(cart)
  } catch (error) {
    console.error('Add to cart error:', error)
    res.status(500).json({ message: 'Failed to add item to cart' })
  }
})

// Update item quantity
router.put('/items/:productId', auth, [
  body('quantity').isInt({ min: 0 }).withMessage('Quantity must be non-negative')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: errors.array()
      })
    }

    const { productId } = req.params
    const { quantity } = req.body

    const cart = await Cart.findOne({ user: req.user._id })
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' })
    }

    const success = cart.updateItemQuantity(productId, quantity)
    if (!success) {
      return res.status(404).json({ message: 'Item not found in cart' })
    }

    await cart.save()
    await cart.populate('items.product')

    res.json(cart)
  } catch (error) {
    console.error('Update cart item error:', error)
    res.status(500).json({ message: 'Failed to update cart item' })
  }
})

// Remove item from cart
router.delete('/items/:productId', auth, async (req, res) => {
  try {
    const { productId } = req.params

    const cart = await Cart.findOne({ user: req.user._id })
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' })
    }

    cart.removeItem(productId)
    await cart.save()
    await cart.populate('items.product')

    res.json(cart)
  } catch (error) {
    console.error('Remove cart item error:', error)
    res.status(500).json({ message: 'Failed to remove cart item' })
  }
})

// Clear cart
router.delete('/', auth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id })
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' })
    }

    cart.clearCart()
    await cart.save()

    res.json(cart)
  } catch (error) {
    console.error('Clear cart error:', error)
    res.status(500).json({ message: 'Failed to clear cart' })
  }
})

module.exports = router




