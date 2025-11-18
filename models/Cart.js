import mongoose from 'mongoose'

const cartItemSchema = new mongoose.Schema({
  itemType: {
    type: String,
    enum: ['product', 'medicine'],
    default: 'product'
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  medicine: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AllMedicine'
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
  },
  name: String,
  image: String
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
cartSchema.methods.addItem = function({ itemType = 'product', productId, medicineId, quantity, price, name, image }) {
  const matcher = (item) => {
    if (itemType === 'medicine') {
      return item.itemType === 'medicine' && item.medicine?.toString() === medicineId?.toString()
    }
    return item.itemType === 'product' && item.product?.toString() === productId?.toString()
  }

  const existingItem = this.items.find(matcher)
  
  if (existingItem) {
    existingItem.quantity += quantity
  } else {
    if (itemType === 'medicine') {
      this.items.push({
        itemType: 'medicine',
        medicine: medicineId,
        quantity,
        price,
        name,
        image
      })
    } else {
      this.items.push({
        itemType: 'product',
        product: productId,
        quantity,
        price,
        name,
        image
      })
    }
  }
  
  this.calculateTotals()
  return this
}

// Method to update item quantity
cartSchema.methods.updateItemQuantity = function({ itemType = 'product', productId, medicineId, quantity }) {
  const item = this.items.find((i) => {
    if (itemType === 'medicine') {
      return i.itemType === 'medicine' && i.medicine?.toString() === medicineId?.toString()
    }
    return i.itemType === 'product' && i.product?.toString() === productId?.toString()
  })
  
  if (item) {
    if (quantity <= 0) {
      this.items = this.items.filter((i) => i !== item)
    } else {
      item.quantity = quantity
    }
    this.calculateTotals()
    return true
  }
  
  return false
}

// Method to remove item from cart
cartSchema.methods.removeItem = function({ itemType = 'product', productId, medicineId }) {
  this.items = this.items.filter((i) => {
    if (itemType === 'medicine') {
      return !(i.itemType === 'medicine' && i.medicine?.toString() === medicineId?.toString())
    }
    return !(i.itemType === 'product' && i.product?.toString() === productId?.toString())
  })
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




