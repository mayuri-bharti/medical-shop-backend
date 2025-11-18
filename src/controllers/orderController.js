import { validationResult } from 'express-validator'
import Cart from '../../models/Cart.js'
import Order from '../../models/Order.js'
import Product from '../../models/Product.js'
import Prescription from '../../models/Prescription.js'

const DELIVERY_FEE = 50
const FREE_DELIVERY_THRESHOLD = 499
const TAX_RATE = 0.18

class CheckoutError extends Error {
  constructor(message, code = 'CHECKOUT_VALIDATION', meta = {}) {
    super(message)
    this.name = 'CheckoutError'
    this.code = code
    this.meta = meta
    this.status = 400
  }
}

const projectOrder = (orderDoc) => {
  if (!orderDoc) {
    return orderDoc
  }

  if (typeof orderDoc.toObject === 'function') {
    const order = orderDoc.toObject({ virtuals: true })
    order.totalAmount = order.total
    return order
  }

  return {
    ...orderDoc,
    totalAmount: orderDoc.total
  }
}

const normalizeShippingAddress = (rawAddress = {}) => {
  const {
    name = '',
    phoneNumber,
    phone,
    street,
    address,
    city = '',
    state = '',
    pincode = '',
    landmark = ''
  } = rawAddress

  return {
    name: String(name || '').trim(),
    phoneNumber: String(phoneNumber || phone || '').trim(),
    address: String(address || street || '').trim(),
    city: String(city || '').trim(),
    state: String(state || '').trim(),
    pincode: String(pincode || '').trim(),
    landmark: String(landmark || '').trim()
  }
}

const resolveSelectedCartItems = async (cart, selectedItems = []) => {
  if (!Array.isArray(selectedItems) || selectedItems.length === 0) {
    throw new CheckoutError('No items selected for checkout', 'ITEMS_REQUIRED')
  }

  const processedCartItemIds = new Set()
  const productCache = new Map()

  const resolved = []

  for (const input of selectedItems) {
    const cartItemId = input.cartItemId?.toString()
    const productId = input.productId?.toString()
    const medicineId = input.medicineId?.toString()

    if (!cartItemId && !productId && !medicineId) {
      throw new CheckoutError(
        'Each selected item must include cartItemId or productId or medicineId',
        'IDENTIFIER_REQUIRED',
        { item: input }
      )
    }

    let cartItem = null
    if (cartItemId) {
      cartItem = cart.items.id(cartItemId)
    }

    if (!cartItem && (productId || medicineId)) {
      cartItem = cart.items.find((item) => {
        if (medicineId) {
          return item.itemType === 'medicine' && item.medicine?.toString() === medicineId
        }
        return item.itemType === 'product' && item.product?.toString() === productId
      })
    }

    if (!cartItem) {
      throw new CheckoutError(
        'Selected item is not present in your cart',
        'ITEM_NOT_FOUND',
        { cartItemId, productId, medicineId }
      )
    }

    const matchedCartItemId = cartItem._id.toString()
    if (processedCartItemIds.has(matchedCartItemId)) {
      throw new CheckoutError(
        'Duplicate cart selection detected',
        'DUPLICATE_SELECTION',
        { cartItemId: matchedCartItemId }
      )
    }
    processedCartItemIds.add(matchedCartItemId)

    const quantity = input.quantity != null ? Number(input.quantity) : cartItem.quantity
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new CheckoutError(
        'Quantity must be a positive integer',
        'INVALID_QUANTITY',
        { cartItemId: matchedCartItemId, quantity: input.quantity }
      )
    }

    if (quantity > cartItem.quantity) {
      throw new CheckoutError(
        'Selected quantity exceeds what is in your cart',
        'QUANTITY_EXCEEDS_CART',
        { cartItemId: matchedCartItemId, requested: quantity, available: cartItem.quantity }
      )
    }

    if (cartItem.itemType === 'product') {
      const resolvedProductId = cartItem.product?._id?.toString() ?? cartItem.product.toString()
      let product = productCache.get(resolvedProductId)

      if (!product) {
        product = await Product.findById(resolvedProductId)
        productCache.set(resolvedProductId, product)
      }

      if (!product || !product.isActive) {
        throw new CheckoutError(
          'Selected product is no longer available',
          'PRODUCT_UNAVAILABLE',
          { productId: resolvedProductId }
        )
      }

      if (product.stock < quantity) {
        throw new CheckoutError(
          `Insufficient stock for ${product.name}`,
          'INSUFFICIENT_STOCK',
          { productId: resolvedProductId, requested: quantity, stock: product.stock }
        )
      }

      resolved.push({
        cartItem,
        product,
        quantity
      })
    } else {
      // Medicine items: no Product lookup or stock enforcement here
      resolved.push({
        cartItem,
        product: null,
        quantity
      })
    }
  }

  return resolved
}

const calculateTotals = (selectedItems = []) => {
  const subtotal = selectedItems.reduce((sum, item) => {
    return sum + (item.cartItem.price * item.quantity)
  }, 0)

  if (subtotal <= 0) {
    throw new CheckoutError('Selected items have invalid pricing', 'INVALID_AMOUNT')
  }

  const deliveryFee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE
  const taxes = Math.round(subtotal * TAX_RATE)
  const total = subtotal + deliveryFee + taxes

  return {
    subtotal,
    deliveryFee,
    taxes,
    total
  }
}

const updateCartAfterCheckout = async (cart, selectedItems = []) => {
  for (const { cartItem, quantity } of selectedItems) {
    const currentItem = cart.items.id(cartItem._id)

    if (!currentItem) {
      continue
    }

    if (quantity >= currentItem.quantity) {
      // Remove only the purchased cart item, leaving others untouched.
      cart.items.pull(currentItem._id)
    } else {
      currentItem.quantity -= quantity
    }
  }

  cart.calculateTotals()
  await cart.save()
}

export const checkoutSelectedItems = async (req, res) => {
  try {
    const errors = validationResult(req)

    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      })
    }

    // Check if user is blocked - prevent blocked users from placing orders
    if (req.user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been blocked. You cannot place new orders. Please contact support for assistance.',
        code: 'USER_BLOCKED'
      })
    }

    const { shippingAddress, paymentMethod, selectedItems, prescriptionId } = req.body
    const normalizedAddress = normalizeShippingAddress(shippingAddress)

    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product')

    if (!cart || cart.items.length === 0) {
      throw new CheckoutError('Your cart is empty', 'CART_EMPTY')
    }

    // Validate prescription if provided
    if (prescriptionId) {
      const prescription = await Prescription.findById(prescriptionId)
      if (!prescription) {
        throw new CheckoutError('Prescription not found', 'PRESCRIPTION_NOT_FOUND')
      }
      if (prescription.user.toString() !== req.user._id.toString()) {
        throw new CheckoutError('Prescription does not belong to user', 'PRESCRIPTION_UNAUTHORIZED')
      }
    }

    const resolvedItems = await resolveSelectedCartItems(cart, selectedItems)
    const totals = calculateTotals(resolvedItems)

    const orderItems = resolvedItems.map(({ cartItem, product, quantity }) => {
      if (cartItem.itemType === 'medicine') {
        return {
          itemType: 'medicine',
          medicine: cartItem.medicine,
          quantity,
          price: cartItem.price,
          name: cartItem.name,
          image: cartItem.image
        }
      }
      return {
        itemType: 'product',
        product: product?._id ?? cartItem.product,
        quantity,
        price: cartItem.price,
        name: product?.name ?? cartItem.name,
        image: product?.images?.[0] || cartItem.image || ''
      }
    })

    const order = new Order({
      user: req.user._id,
      items: orderItems,
      subtotal: totals.subtotal,
      deliveryFee: totals.deliveryFee,
      taxes: totals.taxes,
      total: totals.total,
      shippingAddress: normalizedAddress,
      paymentMethod: paymentMethod?.toUpperCase?.() || 'COD',
      paymentStatus: 'pending',
      status: 'processing',
      prescription: prescriptionId || undefined
    })

    await order.save()

    // Link prescription to order if provided
    if (prescriptionId) {
      try {
        const prescription = await Prescription.findById(prescriptionId)
        if (prescription) {
          prescription.order = order._id
          await prescription.recordStatusChange({
            status: 'ordered',
            changedBy: req.user._id,
            note: 'Order created from prescription'
          })
          await prescription.save()
        }
      } catch (prescriptionError) {
        console.error('Error linking prescription to order:', prescriptionError)
        // Don't fail the order if prescription linking fails
      }
    }

    // Reduce inventory only for items that were actually purchased.
    for (const { cartItem, product, quantity } of resolvedItems) {
      if (cartItem.itemType === 'product' && product) {
        product.reduceStock(quantity)
        await product.save()
      }
      // Medicines: no stock mutation
    }

    // Remove only the purchased items (or decrease their quantities) from the cart.
    await updateCartAfterCheckout(cart, resolvedItems)

    await order.populate('items.product')
    if (order.prescription) {
      await order.populate('prescription')
    }

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: projectOrder(order)
    })
  } catch (error) {
    if (error instanceof CheckoutError) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        code: error.code,
        ...(error.meta && Object.keys(error.meta).length ? { meta: error.meta } : {})
      })
    }

    console.error('Checkout selected items error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to create order'
    })
  }
}

export const getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .populate('items.product')
      .sort({ createdAt: -1 })

    res.json({
      success: true,
      data: orders.map(projectOrder)
    })
  } catch (error) {
    console.error('Get orders error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders'
    })
  }
}

export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id
    }).populate('items.product')

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      })
    }

    res.json({
      success: true,
      data: projectOrder(order)
    })
  } catch (error) {
    console.error('Get order error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order'
    })
  }
}

export const getOrderTracking = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id
    }).populate('items.product')

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      })
    }

    // Return order with status history for tracking
    res.json({
      success: true,
      data: {
        ...projectOrder(order),
        statusHistory: order.statusHistory || []
      }
    })
  } catch (error) {
    console.error('Get order tracking error:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order tracking'
    })
  }
}





