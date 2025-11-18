import express from 'express'
import { body, validationResult } from 'express-validator'
import { auth } from '../middleware/auth.js'
import Cart from '../../models/Cart.js'
import Product from '../../models/Product.js'
import AllMedicine from '../../models/AllMedicine.js'

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
 * Add item to cart (supports products and medicines)
 */
router.post('/items', auth, [
  body('itemType').optional().isIn(['product', 'medicine']).withMessage('Invalid item type'),
  body('productId').optional().isMongoId().withMessage('Invalid product ID'),
  body('medicineId').optional().isMongoId().withMessage('Invalid medicine ID'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body().custom((value) => {
    const hasProduct = !!value.productId
    const hasMedicine = !!value.medicineId
    if (!hasProduct && !hasMedicine) {
      throw new Error('Provide productId or medicineId')
    }
    return true
  })
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

    const { productId, medicineId } = req.body
    const quantity = Number(req.body.quantity)
    const itemType = req.body.itemType || (medicineId ? 'medicine' : 'product')

    let price = 0
    let name = ''
    let image = ''

    if (itemType === 'medicine') {
      const medicine = await AllMedicine.findById(medicineId).lean()
      if (!medicine || medicine.isActive === false) {
        return res.status(404).json({
          success: false,
          message: 'Medicine not found'
        })
      }

      // Compute price with fallback and validate (support string fields like 'price(₹)')
      const rawPrice = medicine.price ?? medicine.mrp ?? medicine['price(₹)'] ?? 0
      let computedPrice = 0
      if (typeof rawPrice === 'number') {
        computedPrice = rawPrice
      } else if (typeof rawPrice === 'string') {
        const sanitized = rawPrice.replace(/[₹$,]/g, '').replace(/\s*(per|\/).*/i, '').trim()
        computedPrice = Number(sanitized)
      } else {
        computedPrice = Number(rawPrice)
      }

      if (!Number.isFinite(computedPrice) || computedPrice <= 0) {
        return res.status(400).json({
          success: false,
          message: 'This medicine has no valid price set'
        })
      }

      price = computedPrice
      name = medicine.name || ''
      image =
        (Array.isArray(medicine.images) && medicine.images[0]) ||
        medicine.image ||
        'https://via.placeholder.com/200x200?text=Medicine'
    } else {
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

      // Validate product price
      const productPrice = Number(product.price) || 0
      if (!Number.isFinite(productPrice) || productPrice <= 0) {
        return res.status(400).json({
          success: false,
          message: 'This product has no valid price set'
        })
      }

      price = productPrice
      name = product.name
      image = product.images?.[0] || 'https://via.placeholder.com/200x200?text=Product'
    }

    // Get or create cart
    let cart = await Cart.findOne({ user: req.user._id })
    if (!cart) {
      cart = new Cart({ user: req.user._id })
    }

    // Add item to cart
    cart.addItem({
      itemType,
      productId,
      medicineId,
      quantity,
      price,
      name,
      image
    })
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

export default router

