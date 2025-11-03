import mongoose from 'mongoose'

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  price: {
    type: Number,
    required: true
  }
})

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [cartItemSchema],
  subtotal: {
    type: Number,
    default: 0
  },
  deliveryFee: {
    type: Number,
    default: 50
  },
  taxes: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
})

// Method to calculate totals
cartSchema.methods.calculateTotals = function() {
  this.subtotal = this.items.reduce((total, item) => {
    return total + (item.price * item.quantity)
  }, 0)
  
  // Free delivery above ₹499
  this.deliveryFee = this.subtotal >= 499 ? 0 : 50
  
  // Calculate taxes (18% GST)
  this.taxes = Math.round(this.subtotal * 0.18)
  
  this.total = this.subtotal + this.deliveryFee + this.taxes
  
  return this
}

// Method to add item to cart
cartSchema.methods.addItem = function(productId, quantity, price) {
  const existingItem = this.items.find(item => 
    item.product.toString() === productId.toString()
  )
  
  if (existingItem) {
    existingItem.quantity += quantity
  } else {
    this.items.push({
      product: productId,
      quantity,
      price
    })
  }
  
  this.calculateTotals()
  return this
}

// Method to update item quantity
cartSchema.methods.updateItemQuantity = function(productId, quantity) {
  const item = this.items.find(item => 
    item.product.toString() === productId.toString()
  )
  
  if (item) {
    if (quantity <= 0) {
      this.items = this.items.filter(item => 
        item.product.toString() !== productId.toString()
      )
    } else {
      item.quantity = quantity
    }
    this.calculateTotals()
    return true
  }
  
  return false
}

// Method to remove item from cart
cartSchema.methods.removeItem = function(productId) {
  this.items = this.items.filter(item => 
    item.product.toString() !== productId.toString()
  )
  this.calculateTotals()
  return this
}

// Method to clear cart
cartSchema.methods.clearCart = function() {
  this.items = []
  this.calculateTotals()
  return this
}

export default mongoose.model('Cart', cartSchema)




