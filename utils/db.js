const mongoose = require('mongoose')

/**
 * Connect to MongoDB
 * @param {string} mongoUri - MongoDB connection string
 * @returns {Promise<mongoose.Connection>}
 */
const connectDB = async (mongoUri) => {
  try {
    const conn = await mongoose.connect(mongoUri)
    console.log(`MongoDB Connected: ${conn.connection.host}`)
    return conn
  } catch (error) {
    console.error('MongoDB connection error:', error.message)
    process.exit(1)
  }
}

/**
 * Close MongoDB connection
 */
const disconnectDB = async () => {
  try {
    await mongoose.connection.close()
    console.log('MongoDB connection closed')
  } catch (error) {
    console.error('Error closing MongoDB connection:', error.message)
  }
}

module.exports = {
  connectDB,
  disconnectDB
}


