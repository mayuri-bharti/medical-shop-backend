const express = require('express')
const { body, validationResult } = require('express-validator')
const { auth } = require('../middleware/auth')
const Cart = require('../../models/Cart')
const Product = require('../../models/Product')

const router = express.Router()

/**
 * GET /cart
 * Get user's cart
 */
router.get('/', auth, async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id }).populate('items.product')
    
    if (!cart) {
      cart = new Cart({ user: req.user._id })
      await cart.save()
    }

    cart.calculateTotals()
    await cart.save()

    res.json({
      success: true,
      data: cart
    })
  } catch (error) {
    console.error('Get cart error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cart'
    })
  }
})

/**
 * POST /cart/items
 * Add item to cart
 */
router.post('/items', auth, [
  body('productId').isMongoId().withMessage('Invalid product ID'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1')
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

    const { productId, quantity } = req.body

    // Check if product exists
    const product = await Product.findById(productId)
    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      })
    }

    if (!product.isInStock()) {
      return res.status(400).json({
        success: false,
        message: 'Product is out of stock'
      })
    }

    // Get or create cart
    let cart = await Cart.findOne({ user: req.user._id })
    if (!cart) {
      cart = new Cart({ user: req.user._id })
    }

    // Add item to cart
    cart.addItem(productId, quantity, product.price)
    await cart.save()
    await cart.populate('items.product')

    res.json({
      success: true,
      message: 'Item added to cart',
      data: cart
    })
  } catch (error) {
    console.error('Add to cart error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to add item to cart'
    })
  }
})

/**
 * DELETE /cart/items/:productId
 * Remove item from cart
 */
router.delete('/items/:productId', auth, async (req, res) => {
  try {
    const { productId } = req.params

    const cart = await Cart.findOne({ user: req.user._id })
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      })
    }

    cart.removeItem(productId)
    await cart.save()
    await cart.populate('items.product')

    res.json({
      success: true,
      message: 'Item removed from cart',
      data: cart
    })
  } catch (error) {
    console.error('Remove from cart error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to remove item from cart'
    })
  }
})

/**
 * DELETE /cart
 * Clear entire cart
 */
router.delete('/', auth, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id })
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      })
    }

    cart.clearCart()
    await cart.save()

    res.json({
      success: true,
      message: 'Cart cleared',
      data: cart
    })
  } catch (error) {
    console.error('Clear cart error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to clear cart'
    })
  }
})

module.exports = router

