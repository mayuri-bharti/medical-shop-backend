const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const { connectDB, disconnectDB } = require('../src/db')
require('dotenv').config()

// Import models
const User = require('../models/User')
const Product = require('../models/Product')
const Otp = require('../models/Otp')

// Sample products data
const sampleProducts = [
  {
    name: 'Paracetamol 500mg Tablet',
    brand: 'Generic',
    sku: 'PAR-500-TAB-10',
    price: 25,
    mrp: 30,
    stock: 100,
    description: 'Effective pain reliever and fever reducer. Fast-acting formula for quick relief from headaches, body aches, and fever.',
    images: ['/images/paracetamol.jpg'],
    category: 'OTC Medicines'
  },
  {
    name: 'Vitamin D3 60,000 IU',
    brand: 'HealthCare Plus',
    sku: 'VITD3-60K-4',
    price: 299,
    mrp: 350,
    stock: 50,
    description: 'High potency Vitamin D3 supplement for bone health and immunity. One capsule per week for optimal vitamin D levels.',
    images: ['/images/vitamind3.jpg'],
    category: 'Health Supplements'
  },
  {
    name: 'Cetirizine 10mg Tablet',
    brand: 'AllerRelief',
    sku: 'CET-10-TAB-10',
    price: 35,
    mrp: 40,
    stock: 150,
    description: 'Fast-acting antihistamine for allergy relief. Effective against seasonal allergies, skin allergies, and allergic rhinitis.',
    images: ['/images/cetirizine.jpg'],
    category: 'Prescription Medicines'
  },
  {
    name: 'Hand Sanitizer 200ml',
    brand: 'CleanHand',
    sku: 'HAND-SAN-200',
    price: 99,
    mrp: 120,
    stock: 200,
    description: 'Alcohol-based hand sanitizer with 70% alcohol content. Kills 99.9% germs and keeps hands clean and protected.',
    images: ['/images/handsanitizer.jpg'],
    category: 'Personal Care'
  },
  {
    name: 'Protein Powder 500g',
    brand: 'FitLife',
    sku: 'PROT-500G-VAN',
    price: 899,
    mrp: 1199,
    stock: 75,
    description: 'Whey protein powder with 25g protein per serving. Builds muscle, Healthy & tasty flavor. Great for post-workout recovery.',
    images: ['/images/protein.jpg'],
    category: 'Health Supplements'
  },
  {
    name: 'Baby Diapers Size M (Pack of 44)',
    brand: 'BabySoft',
    sku: 'DIA-M-44',
    price: 599,
    mrp: 699,
    stock: 60,
    description: 'Ultra-soft baby diapers with wetness indicator. Hypoallergenic and gentle on baby skin. Perfect for overnight use.',
    images: ['/images/diapers.jpg'],
    category: 'Baby Care'
  },
  {
    name: 'Blood Pressure Monitor',
    brand: 'HealthTech',
    sku: 'BP-MON-DIG',
    price: 1299,
    mrp: 1799,
    stock: 30,
    description: 'Digital automatic blood pressure monitor with LCD display. One-touch operation for accurate readings.',
    images: ['/images/bpmonitor.jpg'],
    category: 'Medical Devices'
  },
  {
    name: 'Immunity Booster Syrup',
    brand: 'AyurVeda',
    sku: 'IMM-SYP-200',
    price: 199,
    mrp: 250,
    stock: 100,
    description: 'Natural ayurvedic formula to boost immunity. Made with traditional herbs like Ashwagandha, Tulsi, and Giloy.',
    images: ['/images/immunitysyrup.jpg'],
    category: 'Ayurvedic Products'
  }
]

// Seed function
const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding...')

    // Connect to database
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/medical-shop'
    await connectDB(mongoUri)

    // Clear existing data (optional - uncomment if you want to reset database)
    console.log('🗑️ Clearing existing data...')
    await User.deleteMany({})
    await Product.deleteMany({})
    await Otp.deleteMany({})

    // Create admin user
    console.log('👤 Creating admin user...')
    const adminPhone = '9876543210' // Default admin phone
    
    const adminExists = await User.findOne({ phone: adminPhone })
    if (adminExists) {
      console.log('✅ Admin user already exists')
    } else {
      const adminUser = new User({
        phone: adminPhone,
        name: 'Admin',
        email: 'admin@medishop.com',
        role: 'ADMIN',
        isVerified: true
      })
      await adminUser.save()
      console.log('✅ Admin user created:', adminPhone)
    }

    // Create regular users for testing
    console.log('👥 Creating test users...')
    const testUsers = [
      {
        phone: '9876543211',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'USER',
        isVerified: true
      },
      {
        phone: '9876543212',
        name: 'Jane Smith',
        email: 'jane@example.com',
        role: 'USER',
        isVerified: true
      }
    ]

    for (const userData of testUsers) {
      const existingUser = await User.findOne({ phone: userData.phone })
      if (!existingUser) {
        await User.create(userData)
        console.log(`✅ Test user created: ${userData.phone}`)
      }
    }

    // Create sample products
    console.log('📦 Creating sample products...')
    const createdProducts = await Product.insertMany(sampleProducts)
    console.log(`✅ Created ${createdProducts.length} products`)

    // Display summary
    const userCount = await User.countDocuments()
    const productCount = await Product.countDocuments()

    console.log('\n📊 Seeding Summary:')
    console.log(`   Users: ${userCount}`)
    console.log(`   Products: ${productCount}`)
    console.log('\n🎉 Database seeding completed successfully!')
    console.log('\n📱 Test credentials:')
    console.log('   Admin: 9876543210')
    console.log('   User: 9876543211')
    console.log('   User: 9876543212')

  } catch (error) {
    console.error('❌ Error seeding database:', error)
    throw error
  } finally {
    // Close database connection
    await disconnectDB()
    process.exit(0)
  }
}

// Run seed function
if (require.main === module) {
  seedDatabase().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

module.exports = { seedDatabase }

