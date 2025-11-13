/**
 * Create Admin User Script with Password
 * Usage: node scripts/create-admin.js <phone_number> <name> <password> [email]
 * Example: node scripts/create-admin.js 9890539426 "Admin User" "password123" admin@example.com
 */

import mongoose from 'mongoose'
import dotenv from 'dotenv'
import Admin from '../models/Admin.js'
import { connectDB, disconnectDB } from '../src/db.js'

dotenv.config()

const createAdmin = async () => {
  try {
    // Get arguments from command line
    const phone = process.argv[2]
    const name = process.argv[3]
    const password = process.argv[4]
    const email = process.argv[5] || `admin_${phone}@healthplus.com`

    if (!phone || !name || !password) {
      console.error('❌ Error: Phone number, name, and password are required')
      console.log('Usage: node scripts/create-admin.js <phone_number> <name> <password> [email]')
      console.log('Example: node scripts/create-admin.js 9890539426 "Admin User" "password123" admin@example.com')
      process.exit(1)
    }

    // Validate phone number format (Indian phone number)
    if (!/^[6-9]\d{9}$/.test(phone)) {
      console.error('❌ Error: Invalid phone number format. Must be a 10-digit Indian phone number.')
      process.exit(1)
    }

    // Validate password length
    if (password.length < 6) {
      console.error('❌ Error: Password must be at least 6 characters long.')
      process.exit(1)
    }

    // Validate name length
    if (name.length < 2) {
      console.error('❌ Error: Name must be at least 2 characters long.')
      process.exit(1)
    }

    // Connect to MongoDB
    const mongoUrl = process.env.MONGO_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/medical-shop'
    console.log('🔄 Connecting to MongoDB...')
    await connectDB(mongoUrl)
    console.log('✅ Connected to MongoDB')

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ phone }).select('+password')
    
    if (existingAdmin) {
      if (existingAdmin.isAdmin) {
        console.log('⚠️  Admin already exists:')
        console.log(`📱 Phone: ${existingAdmin.phone}`)
        console.log(`👤 Name: ${existingAdmin.name}`)
        console.log(`📧 Email: ${existingAdmin.email || 'Not set'}`)
        console.log(`🔐 Is Admin: ${existingAdmin.isAdmin}`)
        console.log(`🔑 Password: ${existingAdmin.password ? 'Set' : 'Not set'}`)
        
        // Update password and name if provided
        if (password) {
          console.log('\n⚠️  Updating admin information...')
          existingAdmin.password = password
          existingAdmin.name = name
          if (email) {
            existingAdmin.email = email
          }
          await existingAdmin.save()
          console.log('✅ Admin updated successfully:')
          console.log(`👤 Name: ${existingAdmin.name}`)
          console.log(`📧 Email: ${existingAdmin.email || 'Not set'}`)
          console.log(`🔑 Password: Updated`)
        }
        
        await disconnectDB()
        process.exit(0)
      } else {
        // Update existing user to admin
        existingAdmin.isAdmin = true
        existingAdmin.name = name
        existingAdmin.email = email
        existingAdmin.password = password
        await existingAdmin.save()
        console.log('✅ Updated existing user to admin:')
        console.log(`📱 Phone: ${existingAdmin.phone}`)
        console.log(`👤 Name: ${existingAdmin.name}`)
        console.log(`📧 Email: ${existingAdmin.email}`)
        console.log(`🔑 Password: Set`)
        await disconnectDB()
        process.exit(0)
      }
    }

    // Create new admin with password
    const admin = new Admin({
      phone,
      name,
      email,
      password, // Password will be hashed by mongoose pre-save hook
      isAdmin: true
    })

    await admin.save()
    console.log('✅ Admin created successfully:')
    console.log(`📱 Phone: ${admin.phone}`)
    console.log(`👤 Name: ${admin.name}`)
    console.log(`📧 Email: ${admin.email}`)
    console.log(`🔐 Is Admin: ${admin.isAdmin}`)
    console.log(`🔑 Password: Set`)
    console.log('\n💡 You can now login with this phone/email/name and password at /admin/login')

    await disconnectDB()
    process.exit(0)
  } catch (error) {
    console.error('❌ Error creating admin:', error.message)
    
    if (error.code === 11000) {
      console.error('❌ Admin with this phone number already exists')
    }
    
    process.exit(1)
  }
}

// Run function
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const isMainModule = import.meta.url === `file://${process.argv[1]}` || process.argv[1] === __filename

if (isMainModule) {
  createAdmin()
}

export { createAdmin }