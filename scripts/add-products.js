const mongoose = require('mongoose')
const { connectDB, disconnectDB } = require('../src/db')
require('dotenv').config()

// Import models
const Product = require('../models/Product')

// Sample products data with image URLs
const sampleProducts = [
  {
    name: 'Paracetamol 500mg Tablet',
    brand: 'Generic',
    sku: 'PAR-500-TAB-10',
    price: 25,
    mrp: 30,
    stock: 100,
    description: 'Effective pain reliever and fever reducer. Fast-acting formula for quick relief from headaches, body aches, and fever.',
    images: ['https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&h=400&fit=crop'],
    category: 'OTC Medicines',
    isActive: true
  },
  {
    name: 'Vitamin D3 60,000 IU',
    brand: 'HealthCare Plus',
    sku: 'VITD3-60K-4',
    price: 299,
    mrp: 350,
    stock: 50,
    description: 'High potency Vitamin D3 supplement for bone health and immunity. One capsule per week for optimal vitamin D levels.',
    images: ['https://images.unsplash.com/photo-1550572017-edd951b55104?w=400&h=400&fit=crop'],
    category: 'Health Supplements',
    isActive: true
  },
  {
    name: 'Cetirizine 10mg Tablet',
    brand: 'AllerRelief',
    sku: 'CET-10-TAB-10',
    price: 35,
    mrp: 40,
    stock: 150,
    description: 'Fast-acting antihistamine for allergy relief. Effective against seasonal allergies, skin allergies, and allergic rhinitis.',
    images: ['https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=400&h=400&fit=crop'],
    category: 'Prescription Medicines',
    isActive: true
  },
  {
    name: 'Hand Sanitizer 200ml',
    brand: 'CleanHand',
    sku: 'HAND-SAN-200',
    price: 99,
    mrp: 120,
    stock: 200,
    description: 'Alcohol-based hand sanitizer with 70% alcohol content. Kills 99.9% germs and keeps hands clean and protected.',
    images: ['https://images.unsplash.com/photo-1584589167171-541ce45f1eea?w=400&h=400&fit=crop'],
    category: 'Personal Care',
    isActive: true
  },
  {
    name: 'Protein Powder 500g',
    brand: 'FitLife',
    sku: 'PROT-500G-VAN',
    price: 899,
    mrp: 1199,
    stock: 75,
    description: 'Whey protein powder with 25g protein per serving. Builds muscle, aids recovery. Delicious vanilla flavor. Great for post-workout recovery.',
    images: ['https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=400&h=400&fit=crop'],
    category: 'Health Supplements',
    isActive: true
  },
  {
    name: 'Baby Diapers Size M (Pack of 44)',
    brand: 'BabySoft',
    sku: 'DIA-M-44',
    price: 599,
    mrp: 699,
    stock: 60,
    description: 'Ultra-soft baby diapers with wetness indicator. Hypoallergenic and gentle on baby skin. Perfect for overnight use.',
    images: ['https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=400&h=400&fit=crop'],
    category: 'Baby Care',
    isActive: true
  },
  {
    name: 'Blood Pressure Monitor',
    brand: 'HealthTech',
    sku: 'BP-MON-DIG',
    price: 1299,
    mrp: 1799,
    stock: 30,
    description: 'Digital automatic blood pressure monitor with LCD display. One-touch operation for accurate readings. Memory for 90 readings.',
    images: ['https://images.unsplash.com/photo-1615486511500-2b8c6508e3d4?w=400&h=400&fit=crop'],
    category: 'Medical Devices',
    isActive: true
  },
  {
    name: 'Immunity Booster Syrup',
    brand: 'AyurVeda',
    sku: 'IMM-SYP-200',
    price: 199,
    mrp: 250,
    stock: 100,
    description: 'Natural ayurvedic formula to boost immunity. Made with traditional herbs like Ashwagandha, Tulsi, and Giloy.',
    images: ['https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=400&h=400&fit=crop'],
    category: 'Ayurvedic Products',
    isActive: true
  },
  {
    name: 'Digital Thermometer',
    brand: 'HealthTech',
    sku: 'THERM-DIG-01',
    price: 199,
    mrp: 299,
    stock: 80,
    description: 'Fast and accurate digital thermometer. Beeps when reading is complete. Memory recall function. Waterproof design.',
    images: ['https://images.unsplash.com/photo-1584589167171-541ce45f1eea?w=400&h=400&fit=crop'],
    category: 'Medical Devices',
    isActive: true
  },
  {
    name: 'Omega 3 Fish Oil Capsules',
    brand: 'HealthCare Plus',
    sku: 'OMEGA3-60CAP',
    price: 499,
    mrp: 650,
    stock: 90,
    description: 'High-quality fish oil with EPA and DHA for heart and brain health. 60 softgel capsules. Supports cardiovascular function.',
    images: ['https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=400&h=400&fit=crop'],
    category: 'Health Supplements',
    isActive: true
  },
  {
    name: 'Multivitamin Tablets',
    brand: 'VitaMax',
    sku: 'MULTI-VIT-30',
    price: 299,
    mrp: 399,
    stock: 120,
    description: 'Complete multivitamin formula with essential vitamins and minerals. Supports overall health and wellness. 30 tablets.',
    images: ['https://images.unsplash.com/photo-1550572017-edd951b55104?w=400&h=400&fit=crop'],
    category: 'Health Supplements',
    isActive: true
  },
  {
    name: 'Face Mask Surgical (Pack of 50)',
    brand: 'MediSafe',
    sku: 'MASK-SUR-50',
    price: 249,
    mrp: 350,
    stock: 150,
    description: '3-ply surgical face masks. Breathable, comfortable, and protective. Ideal for daily use. Pack of 50 masks.',
    images: ['https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&h=400&fit=crop'],
    category: 'Personal Care',
    isActive: true
  },
  {
    name: 'Antiseptic Cream 30g',
    brand: 'HealWell',
    sku: 'ANTI-CRM-30',
    price: 85,
    mrp: 110,
    stock: 110,
    description: 'Antibacterial antiseptic cream for minor cuts, wounds, and skin infections. Fast healing formula. 30g tube.',
    images: ['https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&h=400&fit=crop'],
    category: 'OTC Medicines',
    isActive: true
  },
  {
    name: 'Cough Syrup 100ml',
    brand: 'BronchoCare',
    sku: 'COUGH-SYP-100',
    price: 125,
    mrp: 150,
    stock: 85,
    description: 'Effective relief from dry and wet cough. Soothes throat irritation. Suitable for adults and children above 6 years.',
    images: ['https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=400&h=400&fit=crop'],
    category: 'OTC Medicines',
    isActive: true
  },
  {
    name: 'Glucose Monitor Kit',
    brand: 'DiabCare',
    sku: 'GLUC-MON-KIT',
    price: 1499,
    mrp: 1999,
    stock: 40,
    description: 'Complete blood glucose monitoring system. Includes meter, lancets, and test strips. Accurate results in 5 seconds.',
    images: ['https://images.unsplash.com/photo-1615486511500-2b8c6508e3d4?w=400&h=400&fit=crop'],
    category: 'Medical Devices',
    isActive: true
  },
  {
    name: 'Calcium + Vitamin D Tablets',
    brand: 'BoneStrength',
    sku: 'CAL-VD-60',
    price: 349,
    mrp: 450,
    stock: 95,
    description: 'Essential calcium with vitamin D3 for strong bones and teeth. Prevents osteoporosis. 60 tablets. One per day.',
    images: ['https://images.unsplash.com/photo-1550572017-edd951b55104?w=400&h=400&fit=crop'],
    category: 'Health Supplements',
    isActive: true
  }
]

// Add products function
const addProducts = async () => {
  try {
    console.log('🌱 Starting product seeding...')

    // Connect to database
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/medical-shop'
    await connectDB(mongoUri)

    // Check existing products
    const existingCount = await Product.countDocuments()
    console.log(`📊 Existing products: ${existingCount}`)

    if (existingCount > 0) {
      console.log('⚠️  Products already exist. Clearing old products...')
      await Product.deleteMany({})
      console.log('✅ Old products cleared')
    }

    // Create sample products
    console.log('📦 Adding products to database...')
    const createdProducts = await Product.insertMany(sampleProducts)
    console.log(`✅ Successfully added ${createdProducts.length} products`)

    // Display summary
    const productCount = await Product.countDocuments()
    const categories = await Product.distinct('category')

    console.log('\n📊 Product Summary:')
    console.log(`   Total Products: ${productCount}`)
    console.log(`   Categories: ${categories.length}`)
    console.log('\n📋 Categories:')
    categories.forEach(cat => console.log(`   - ${cat}`))
    
    console.log('\n🎉 Products added successfully!')
    console.log('\n💡 You can now view products at: http://localhost:5173/products')

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
if (require.main === module) {
  addProducts().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

module.exports = { addProducts }



