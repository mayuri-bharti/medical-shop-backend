/**
 * Add Wellness Packages Script
 * Adds the three wellness packages shown in the UI
 * Usage: node scripts/add-wellness-packages.js
 */

import mongoose from 'mongoose'
import { connectDB, disconnectDB } from '../src/db.js'
import dotenv from 'dotenv'
import Product from '../models/Product.js'

dotenv.config()

const wellnessPackages = [
  {
    name: 'Immunity Booster Pack',
    brand: 'HealthPlus',
    sku: 'HP-IMMUNITY-001',
    price: 1299,
    mrp: 1599,
    stock: 50,
    description: 'A comprehensive immunity booster pack containing essential vitamins, minerals, and supplements to strengthen your immune system. Perfect for maintaining good health and preventing illnesses.',
    images: ['https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400&h=400&fit=crop'],
    category: 'Wellness Products',
    isActive: true
  },
  {
    name: 'Diabetes Care Package',
    brand: 'HealthPlus',
    sku: 'HP-DIABETES-001',
    price: 2499,
    mrp: 2999,
    stock: 30,
    description: 'Complete diabetes care package with blood sugar monitoring essentials, supplements, and dietary aids. Designed to help manage diabetes effectively and maintain healthy blood sugar levels.',
    images: ['https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&h=400&fit=crop'],
    category: 'Wellness Products',
    isActive: true
  },
  {
    name: 'Senior Wellness Kit',
    brand: 'HealthPlus',
    sku: 'HP-SENIOR-001',
    price: 1999,
    mrp: 2399,
    stock: 40,
    description: 'Specially curated wellness kit for seniors with bone health supplements, joint care products, and essential vitamins. Supports healthy aging and maintains vitality.',
    images: ['https://images.unsplash.com/photo-1559757175-0eb30cd8c063?w=400&h=400&fit=crop'],
    category: 'Wellness Products',
    isActive: true
  }
]

const addWellnessPackages = async () => {
  try {
    console.log('\n📦 Adding Wellness Packages to Database\n')
    console.log('='.repeat(50))

    // Connect to database
    const mongoUri = process.env.MONGO_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/medical-shop'
    console.log('🔄 Connecting to MongoDB...')
    await connectDB(mongoUri)
    console.log('✅ Connected to MongoDB\n')

    let added = 0
    let updated = 0
    let skipped = 0

    for (const packageData of wellnessPackages) {
      try {
        // Check if product with this SKU already exists
        const existingProduct = await Product.findOne({ sku: packageData.sku })
        
        if (existingProduct) {
          console.log(`⚠️  Product "${packageData.name}" (SKU: ${packageData.sku}) already exists`)
          // Update existing product
          Object.assign(existingProduct, packageData)
          await existingProduct.save()
          updated++
          console.log(`   ✅ Updated: ${packageData.name}`)
        } else {
          // Create new product
          const product = new Product(packageData)
          await product.save()
          added++
          console.log(`   ✅ Added: ${packageData.name} - ₹${packageData.price} (MRP: ₹${packageData.mrp})`)
        }
      } catch (error) {
        if (error.code === 11000) {
          console.log(`   ⚠️  Skipped: ${packageData.name} - Duplicate SKU`)
          skipped++
        } else {
          console.error(`   ❌ Error adding ${packageData.name}:`, error.message)
        }
      }
    }

    console.log('\n' + '='.repeat(50))
    console.log('📊 Summary:')
    console.log(`   ✅ Added: ${added} products`)
    console.log(`   🔄 Updated: ${updated} products`)
    console.log(`   ⏭️  Skipped: ${skipped} products`)

    const totalProducts = await Product.countDocuments({ isActive: true })
    console.log(`\n📦 Total Active Products: ${totalProducts}`)

    await disconnectDB()
    console.log('\n✅ Database connection closed')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error.message)
    await disconnectDB().catch(() => {})
    process.exit(1)
  }
}

addWellnessPackages()












