/**
 * Vercel Serverless Function Entry Point
 * This file is the entry point for Vercel serverless functions
 * It imports the Express app and ensures database connection per-request
 */

import app from '../index.js'
import { connectDB } from '../src/db.js'
import dotenv from 'dotenv'
import mongoose from 'mongoose'

dotenv.config()

// For Vercel serverless: Ensure DB connection on each function invocation
let isConnecting = false
let connectionPromise = null

const ensureDBConnection = async () => {
  // Check if already connected
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection
  }
  
  // If already connecting, wait for that promise
  if (isConnecting && connectionPromise) {
    return connectionPromise
  }
  
  // Start new connection
  isConnecting = true
  const mongoUrl = process.env.MONGODB_URI || process.env.MONGO_URL
  
  if (!mongoUrl) {
    console.error('❌ MONGO_URL/MONGODB_URI not set in Vercel environment variables')
    isConnecting = false
    return null
  }
  
  try {
    connectionPromise = connectDB(mongoUrl)
    const conn = await connectionPromise
    isConnecting = false
    console.log('✅ MongoDB connected in serverless function')
    return conn
  } catch (error) {
    isConnecting = false
    connectionPromise = null
    console.error('❌ Failed to connect to MongoDB in serverless function:', error.message)
    return null
  }
}

// Ensure DB connection before exporting handler
// This runs on cold start, but we also check in each request
ensureDBConnection().catch((error) => {
  console.error('❌ Initial DB connection attempt failed:', error.message)
})

// Middleware to ensure DB connection on each request
// This MUST run before routes to ensure DB is connected
app.use(async (req, res, next) => {
  // Only check for API routes
  if (req.path.startsWith('/api') || req.path === '/') {
    // If not connected, try to connect
    if (mongoose.connection.readyState !== 1) {
      try {
        const conn = await ensureDBConnection()
        
        // Wait a bit if connection is in progress
        if (!conn && mongoose.connection.readyState === 2) {
          let waited = 0
          const maxWait = 5000 // 5 seconds
          while (mongoose.connection.readyState === 2 && waited < maxWait) {
            await new Promise(resolve => setTimeout(resolve, 200))
            waited += 200
            if (mongoose.connection.readyState === 1) break
          }
        }
      } catch (error) {
        console.error('❌ DB connection error in middleware:', error.message)
        // Continue anyway - route will handle the error
      }
    }
  }
  next()
})

// Add a simple test route to verify serverless function is working
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Serverless API is working',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    environment: process.env.NODE_ENV || 'production'
  })
})

// Export the app for Vercel serverless function
// DO NOT call app.listen() here - Vercel handles that
export default app
