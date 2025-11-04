/**
 * Add Single Product Script
 * Usage: node scripts/add-single-product.js
 * Or provide product details as arguments
 */

import mongoose from 'mongoose'
import { connectDB, disconnectDB } from '../src/db.js'
import dotenv from 'dotenv'
import Product from '../models/Product.js'
import readline from 'readline'

dotenv.config()

// Helper function to read input from user
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const question = (prompt) => {
  return new Promise((resolve) => {
    rl.question(prompt, resolve)
  })
}

const addProduct = async () => {
  try {
    console.log('\n📦 Add Product to Database\n')
    console.log('='.repeat(50))

    // Connect to database
    const mongoUri = process.env.MONGO_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/medical-shop'
    console.log('🔄 Connecting to MongoDB...')
    await connectDB(mongoUri)
    console.log('✅ Connected to MongoDB\n')

    // Get product details from user
    const name = await question('Product Name: ')
    if (!name.trim()) {
      console.error('❌ Product name is required!')
      process.exit(1)
    }

    const brand = await question('Brand: ') || 'Generic'
    const sku = await question('SKU (leave empty for auto-generated): ') || `SKU-${Date.now()}`
    const price = parseFloat(await question('Price (₹): ')) || 0
    const mrp = parseFloat(await question('MRP (₹): ')) || price * 1.2
    const stock = parseInt(await question('Stock (quantity): ')) || 0
    const description = await question('Description: ') || ''
    
    console.log('\nCategories:')
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
    categories.forEach((cat, idx) => console.log(`  ${idx + 1}. ${cat}`))
    
    const categoryNum = parseInt(await question('\nSelect Category (1-8): ')) || 1
    const category = categories[categoryNum - 1] || categories[0]
    
    const imageUrl = await question('Image URL (optional): ') || 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&h=400&fit=crop'

    // Create product
    const productData = {
      name: name.trim(),
      brand: brand.trim(),
      sku: sku.trim().toUpperCase(),
      price,
      mrp,
      stock,
      description: description.trim(),
      images: imageUrl ? [imageUrl.trim()] : [],
      category,
      isActive: true
    }

    console.log('\n📝 Product Details:')
    console.log(JSON.stringify(productData, null, 2))

    const confirm = await question('\n✅ Confirm and add this product? (y/n): ')
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      console.log('❌ Cancelled')
      process.exit(0)
    }

    // Check if SKU already exists
    const existingProduct = await Product.findOne({ sku: productData.sku })
    if (existingProduct) {
      console.error(`❌ Product with SKU "${productData.sku}" already exists!`)
      const update = await question('Update existing product? (y/n): ')
      if (update.toLowerCase() === 'y' || update.toLowerCase() === 'yes') {
        Object.assign(existingProduct, productData)
        await existingProduct.save()
        console.log('✅ Product updated successfully!')
      } else {
        console.log('❌ Cancelled')
        process.exit(0)
      }
    } else {
      // Create new product
      const product = new Product(productData)
      await product.save()
      console.log('✅ Product added successfully!')
      console.log(`📦 Product ID: ${product._id}`)
    }

    // Display summary
    const totalProducts = await Product.countDocuments({ isActive: true })
    console.log(`\n📊 Total Active Products: ${totalProducts}`)

    await disconnectDB()
    console.log('\n✅ Database connection closed')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.code === 11000) {
      console.error('💡 Duplicate SKU - Product with this SKU already exists')
    }
    await disconnectDB().catch(() => {})
    process.exit(1)
  } finally {
    rl.close()
  }
}

addProduct()

