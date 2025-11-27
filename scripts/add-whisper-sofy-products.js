import mongoose from 'mongoose'
import { connectDB, disconnectDB } from '../src/db.js'
import dotenv from 'dotenv'
dotenv.config()

// Import models
import Product from '../models/Product.js'

// Whisper Sofy Products
const whisperSofyProducts = [
  {
    name: 'Whisper Ultra Clean Sanitary Pads - Regular (Pack of 8)',
    brand: 'Whisper',
    sku: 'WHISPER-ULTRA-REG-8',
    price: 89,
    mrp: 120,
    stock: 150,
    description: 'Ultra-clean sanitary pads with advanced protection. Soft, comfortable, and highly absorbent. Regular size for normal flow days.',
    images: ['https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&h=400&fit=crop'],
    category: 'Personal Care',
    isActive: true
  },
  {
    name: 'Whisper Ultra Clean Sanitary Pads - Regular (Pack of 20)',
    brand: 'Whisper',
    sku: 'WHISPER-ULTRA-REG-20',
    price: 199,
    mrp: 280,
    stock: 100,
    description: 'Ultra-clean sanitary pads with advanced protection. Soft, comfortable, and highly absorbent. Regular size for normal flow days. Value pack.',
    images: ['https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&h=400&fit=crop'],
    category: 'Personal Care',
    isActive: true
  },
  {
    name: 'Whisper Ultra Clean Sanitary Pads - XL (Pack of 8)',
    brand: 'Whisper',
    sku: 'WHISPER-ULTRA-XL-8',
    price: 99,
    mrp: 135,
    stock: 120,
    description: 'Ultra-clean sanitary pads with advanced protection. Extra-large size for heavy flow days. Maximum absorbency and comfort.',
    images: ['https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&h=400&fit=crop'],
    category: 'Personal Care',
    isActive: true
  },
  {
    name: 'Whisper Ultra Clean Sanitary Pads - XL (Pack of 20)',
    brand: 'Whisper',
    sku: 'WHISPER-ULTRA-XL-20',
    price: 219,
    mrp: 310,
    stock: 90,
    description: 'Ultra-clean sanitary pads with advanced protection. Extra-large size for heavy flow days. Maximum absorbency and comfort. Value pack.',
    images: ['https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&h=400&fit=crop'],
    category: 'Personal Care',
    isActive: true
  },
  {
    name: 'Whisper Ultra Night Sanitary Pads (Pack of 8)',
    brand: 'Whisper',
    sku: 'WHISPER-ULTRA-NIGHT-8',
    price: 109,
    mrp: 150,
    stock: 110,
    description: 'Ultra-night sanitary pads with extra-long protection. Designed for overnight use with maximum absorbency and leak protection.',
    images: ['https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&h=400&fit=crop'],
    category: 'Personal Care',
    isActive: true
  },
  {
    name: 'Whisper Ultra Night Sanitary Pads (Pack of 20)',
    brand: 'Whisper',
    sku: 'WHISPER-ULTRA-NIGHT-20',
    price: 249,
    mrp: 350,
    stock: 80,
    description: 'Ultra-night sanitary pads with extra-long protection. Designed for overnight use with maximum absorbency and leak protection. Value pack.',
    images: ['https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&h=400&fit=crop'],
    category: 'Personal Care',
    isActive: true
  },
  {
    name: 'Whisper Ultra Go Tension Free Sanitary Pads - Regular (Pack of 8)',
    brand: 'Whisper',
    sku: 'WHISPER-GO-REG-8',
    price: 95,
    mrp: 130,
    stock: 140,
    description: 'Tension-free sanitary pads with ultra-thin design. Maximum comfort and protection. Regular size for normal flow days.',
    images: ['https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&h=400&fit=crop'],
    category: 'Personal Care',
    isActive: true
  },
  {
    name: 'Whisper Ultra Go Tension Free Sanitary Pads - Regular (Pack of 20)',
    brand: 'Whisper',
    sku: 'WHISPER-GO-REG-20',
    price: 209,
    mrp: 300,
    stock: 95,
    description: 'Tension-free sanitary pads with ultra-thin design. Maximum comfort and protection. Regular size for normal flow days. Value pack.',
    images: ['https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&h=400&fit=crop'],
    category: 'Personal Care',
    isActive: true
  },
  {
    name: 'Sofy Antibacteria Sanitary Pads - Regular (Pack of 8)',
    brand: 'Sofy',
    sku: 'SOFY-ANTI-REG-8',
    price: 85,
    mrp: 115,
    stock: 130,
    description: 'Antibacterial sanitary pads with advanced protection. Prevents bacterial growth and keeps you fresh. Regular size for normal flow days.',
    images: ['https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&h=400&fit=crop'],
    category: 'Personal Care',
    isActive: true
  },
  {
    name: 'Sofy Antibacteria Sanitary Pads - Regular (Pack of 20)',
    brand: 'Sofy',
    sku: 'SOFY-ANTI-REG-20',
    price: 189,
    mrp: 270,
    stock: 85,
    description: 'Antibacterial sanitary pads with advanced protection. Prevents bacterial growth and keeps you fresh. Regular size for normal flow days. Value pack.',
    images: ['https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&h=400&fit=crop'],
    category: 'Personal Care',
    isActive: true
  },
  {
    name: 'Sofy Antibacteria Sanitary Pads - XL (Pack of 8)',
    brand: 'Sofy',
    sku: 'SOFY-ANTI-XL-8',
    price: 95,
    mrp: 130,
    stock: 115,
    description: 'Antibacterial sanitary pads with advanced protection. Prevents bacterial growth and keeps you fresh. Extra-large size for heavy flow days.',
    images: ['https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&h=400&fit=crop'],
    category: 'Personal Care',
    isActive: true
  },
  {
    name: 'Sofy Antibacteria Sanitary Pads - XL (Pack of 20)',
    brand: 'Sofy',
    sku: 'SOFY-ANTI-XL-20',
    price: 209,
    mrp: 300,
    stock: 75,
    description: 'Antibacterial sanitary pads with advanced protection. Prevents bacterial growth and keeps you fresh. Extra-large size for heavy flow days. Value pack.',
    images: ['https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&h=400&fit=crop'],
    category: 'Personal Care',
    isActive: true
  },
  {
    name: 'Sofy Bodyfit Sanitary Pads - Regular (Pack of 8)',
    brand: 'Sofy',
    sku: 'SOFY-BODYFIT-REG-8',
    price: 89,
    mrp: 120,
    stock: 125,
    description: 'Bodyfit sanitary pads with perfect fit design. Soft, comfortable, and highly absorbent. Regular size for normal flow days.',
    images: ['https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&h=400&fit=crop'],
    category: 'Personal Care',
    isActive: true
  },
  {
    name: 'Sofy Bodyfit Sanitary Pads - Regular (Pack of 20)',
    brand: 'Sofy',
    sku: 'SOFY-BODYFIT-REG-20',
    price: 199,
    mrp: 280,
    stock: 80,
    description: 'Bodyfit sanitary pads with perfect fit design. Soft, comfortable, and highly absorbent. Regular size for normal flow days. Value pack.',
    images: ['https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&h=400&fit=crop'],
    category: 'Personal Care',
    isActive: true
  },
  {
    name: 'Sofy Bodyfit Sanitary Pads - XL (Pack of 8)',
    brand: 'Sofy',
    sku: 'SOFY-BODYFIT-XL-8',
    price: 99,
    mrp: 135,
    stock: 105,
    description: 'Bodyfit sanitary pads with perfect fit design. Soft, comfortable, and highly absorbent. Extra-large size for heavy flow days.',
    images: ['https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&h=400&fit=crop'],
    category: 'Personal Care',
    isActive: true
  },
  {
    name: 'Sofy Bodyfit Sanitary Pads - XL (Pack of 20)',
    brand: 'Sofy',
    sku: 'SOFY-BODYFIT-XL-20',
    price: 219,
    mrp: 310,
    stock: 70,
    description: 'Bodyfit sanitary pads with perfect fit design. Soft, comfortable, and highly absorbent. Extra-large size for heavy flow days. Value pack.',
    images: ['https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&h=400&fit=crop'],
    category: 'Personal Care',
    isActive: true
  }
]

// Add products function
const addWhisperSofyProducts = async () => {
  try {
    console.log('🌱 Starting Whisper Sofy product seeding...')

    // Connect to database
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/medical-shop'
    await connectDB(mongoUri)
    console.log('✅ Connected to database')

    // Check existing products with same SKUs
    const existingSkus = whisperSofyProducts.map(p => p.sku)
    const existingProducts = await Product.find({ sku: { $in: existingSkus } })
    
    if (existingProducts.length > 0) {
      console.log(`⚠️  Found ${existingProducts.length} existing products with same SKUs. Updating them...`)
      for (const product of existingProducts) {
        const newProductData = whisperSofyProducts.find(p => p.sku === product.sku)
        if (newProductData) {
          Object.assign(product, newProductData)
          await product.save()
        }
      }
      console.log('✅ Existing products updated')
    }

    // Add new products (skip existing SKUs)
    const existingSkusSet = new Set(existingProducts.map(p => p.sku))
    const newProducts = whisperSofyProducts.filter(p => !existingSkusSet.has(p.sku))
    
    if (newProducts.length > 0) {
      console.log(`📦 Adding ${newProducts.length} new products to database...`)
      const createdProducts = await Product.insertMany(newProducts)
      console.log(`✅ Successfully added ${createdProducts.length} new products`)
    } else {
      console.log('ℹ️  All products already exist in database')
    }

    // Display summary
    const whisperCount = await Product.countDocuments({ brand: 'Whisper' })
    const sofyCount = await Product.countDocuments({ brand: 'Sofy' })
    const totalCount = whisperCount + sofyCount

    console.log('\n📊 Product Summary:')
    console.log(`   Whisper Products: ${whisperCount}`)
    console.log(`   Sofy Products: ${sofyCount}`)
    console.log(`   Total Whisper/Sofy Products: ${totalCount}`)
    
    console.log('\n🎉 Whisper Sofy products added successfully!')
    console.log('\n💡 You can now view products at: http://localhost:5173/products?brand=Whisper')
    console.log('💡 Or: http://localhost:5173/products?brand=Sofy')

  } catch (error) {
    console.error('❌ Error adding products:', error)
    throw error
  } finally {
    // Close database connection
    await disconnectDB()
    process.exit(0)
  }
}

// Run function
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url)
const isMainModule = process.argv[1] && __filename === process.argv[1]

// Always run if called directly
if (isMainModule || process.argv[1]?.endsWith('add-whisper-sofy-products.js')) {
  addWhisperSofyProducts().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

export { addWhisperSofyProducts }



































