/**
 * Add Admin User Script
 * Usage: node scripts/add-admin.js <phone_number> [name] [email]
 * Example: node scripts/add-admin.js 9890539426 "Admin User" admin@example.com
 */

import mongoose from 'mongoose'
import dotenv from 'dotenv'
import User from '../models/User.js'
import { connectDB } from '../src/db.js'

dotenv.config()

const addAdmin = async () => {
  try {
    // Get phone number from command line arguments
    const phone = process.argv[2]
    const name = process.argv[3] || 'Admin User'
    const email = process.argv[4] || `admin_${phone}@HealthPlus.com`

    if (!phone) {
      console.error('❌ Error: Phone number is required')
      console.log('Usage: node scripts/add-admin.js <phone_number> [name] [email]')
      console.log('Example: node scripts/add-admin.js 9890539426 "Admin User" admin@example.com')
      process.exit(1)
    }

    // Validate phone number format (Indian phone number)
    if (!/^[6-9]\d{9}$/.test(phone)) {
      console.error('❌ Error: Invalid phone number format. Must be a 10-digit Indian phone number.')
      process.exit(1)
    }

    // Connect to MongoDB
    const mongoUrl = process.env.MONGO_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/medical-shop'
    console.log('🔄 Connecting to MongoDB...')
    await connectDB(mongoUrl)
    console.log('✅ Connected to MongoDB')

    // Check if user already exists
    const existingUser = await User.findOne({ phone })
    
    if (existingUser) {
      if (existingUser.role === 'ADMIN') {
        console.log('✅ User already exists and is already an ADMIN')
        console.log(`📱 Phone: ${existingUser.phone}`)
        console.log(`👤 Name: ${existingUser.name}`)
        console.log(`📧 Email: ${existingUser.email || 'Not set'}`)
        console.log(`🔐 Role: ${existingUser.role}`)
        await mongoose.connection.close()
        process.exit(0)
      } else {
        // Update existing user to admin
        existingUser.role = 'ADMIN'
        existingUser.name = name
        if (email) existingUser.email = email
        await existingUser.save()
        
        console.log('✅ Updated existing user to ADMIN')
        console.log(`📱 Phone: ${existingUser.phone}`)
        console.log(`👤 Name: ${existingUser.name}`)
        console.log(`📧 Email: ${existingUser.email || 'Not set'}`)
        console.log(`🔐 Role: ${existingUser.role}`)
        
        await mongoose.connection.close()
        process.exit(0)
      }
    }

    // Create new admin user
    const adminUser = new User({
      phone,
      name,
      email,
      role: 'ADMIN',
      isVerified: true
    })

    await adminUser.save()

    console.log('✅ Admin user created successfully!')
    console.log(`📱 Phone: ${adminUser.phone}`)
    console.log(`👤 Name: ${adminUser.name}`)
    console.log(`📧 Email: ${adminUser.email}`)
    console.log(`🔐 Role: ${adminUser.role}`)
    console.log(`✅ Verified: ${adminUser.isVerified}`)
    
    await mongoose.connection.close()
    console.log('✅ Database connection closed')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.message.includes('duplicate key')) {
      console.error('💡 User with this phone number already exists')
    }
    await mongoose.connection.close().catch(() => {})
    process.exit(1)
  }
}

addAdmin()



