/**
 * Vercel Serverless Function for Google OAuth Initiation
 * GET /api/auth/google
 * 
 * This serverless function initiates the Google OAuth flow.
 * It redirects the user to Google's authorization page.
 */

import 'dotenv/config'
import passport, { isGoogleAuthConfigured } from '../../config/passport.js'
import session from 'express-session'
import MongoStore from 'connect-mongo'
import mongoose from 'mongoose'
import { connectDB } from '../../src/db.js'

// Ensure DB connection for session storage
const ensureDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection
  }
  
  const mongoUrl = process.env.MONGODB_URI || process.env.MONGO_URL
  if (!mongoUrl) {
    throw new Error('MongoDB connection string not found')
  }
  
  try {
    await connectDB(mongoUrl)
    return mongoose.connection
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error.message)
    throw error
  }
}

// Helper to run middleware in promise
const runMiddleware = (req, res, fn) => {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result)
      }
      return resolve(result)
    })
  })
}

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    })
  }

  try {
    // Check if Google Auth is configured
    if (!isGoogleAuthConfigured) {
      return res.status(503).json({
        success: false,
        message: 'Google login is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server.'
      })
    }

    // Ensure database connection
    await ensureDB()

    // Create session middleware
    const sessionSecret = process.env.SESSION_SECRET || 'super-secure-session-secret'
    const mongoUrl = process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/medical-shop'
    
    const sessionMiddleware = session({
      name: process.env.SESSION_COOKIE_NAME || 'medical.sid',
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        mongoUrl,
        collectionName: 'sessions',
        ttl: 14 * 24 * 60 * 60
      }),
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
      }
    })

    // Run session middleware
    await runMiddleware(req, res, sessionMiddleware)

    // Run passport initialization
    await runMiddleware(req, res, passport.initialize())
    await runMiddleware(req, res, passport.session())

    // Authenticate with Google (this will redirect to Google)
    passport.authenticate('google', {
      scope: ['profile', 'email'],
      prompt: 'select_account'
    })(req, res)

  } catch (error) {
    console.error('❌ Error in Google OAuth initiation:', error.message)
    console.error('Stack:', error.stack)
    return res.status(500).json({
      success: false,
      message: 'Failed to initiate Google login',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}

