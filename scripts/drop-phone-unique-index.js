/**
 * Script to drop the unique index on phone field
 * This allows multiple users to have the same phone number with different emails
 * 
 * Run with: node scripts/drop-phone-unique-index.js
 */

import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()

const mongoUrl = process.env.MONGO_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/medical-shop'

async function dropPhoneUniqueIndex() {
  try {
    console.log('🔄 Connecting to MongoDB...')
    await mongoose.connect(mongoUrl)
    console.log('✅ Connected to MongoDB')

    const db = mongoose.connection.db
    const collection = db.collection('users')

    // Get all indexes
    const indexes = await collection.indexes()
    console.log('📋 Current indexes:', indexes.map(idx => idx.name))

    // Find phone unique index
    const phoneIndex = indexes.find(idx => 
      idx.key && idx.key.phone === 1 && idx.unique === true
    )

    if (phoneIndex) {
      console.log(`🗑️  Dropping unique index on phone: ${phoneIndex.name}`)
      await collection.dropIndex(phoneIndex.name)
      console.log('✅ Successfully dropped phone unique index')
      console.log('✅ Users can now have the same phone number with different emails')
    } else {
      console.log('ℹ️  No unique index found on phone field')
    }

    // Show updated indexes
    const updatedIndexes = await collection.indexes()
    console.log('📋 Updated indexes:', updatedIndexes.map(idx => idx.name))

    await mongoose.disconnect()
    console.log('✅ Disconnected from MongoDB')
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

dropPhoneUniqueIndex()

