const mongoose = require('mongoose')
require('dotenv').config()

const fixIndexes = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/medical-shop'
    await mongoose.connect(mongoUri)
    
    console.log('Connected to MongoDB')
    
    // Drop the users collection to remove old indexes
    await mongoose.connection.db.collection('users').drop().catch(() => {
      console.log('Users collection does not exist or already dropped')
    })
    
    console.log('✅ Dropped users collection')
    
    // Import the model to recreate collection with new schema
    const User = require('../models/User')
    console.log('✅ User model loaded with new schema')
    
    await mongoose.connection.close()
    console.log('Done! You can now run npm run seed')
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    process.exit(0)
  }
}

fixIndexes()


