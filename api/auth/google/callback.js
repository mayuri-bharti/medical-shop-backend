/**
 * Vercel Serverless Function for Google OAuth Callback
 * GET /api/auth/google/callback
 * 
 * This serverless function handles the callback from Google OAuth.
 * It processes the authentication, creates/logs in the user, and redirects to frontend.
 */

import 'dotenv/config'
import passport, { isGoogleAuthConfigured } from '../../../config/passport.js'
import { createTokens } from '../../../src/services/otpService.js'
import session from 'express-session'
import MongoStore from 'connect-mongo'
import mongoose from 'mongoose'
import { connectDB } from '../../../src/db.js'

const FRONTEND_URL = process.env.FRONTEND_URL || process.env.FRONTEND_BASE_URL || 'http://localhost:5173'

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
      const errorUrl = new URL(`${FRONTEND_URL}/login`)
      errorUrl.searchParams.set('error', encodeURIComponent('Google login is not configured'))
      return res.redirect(errorUrl.toString())
    }

    // Validate that we have the required OAuth parameters from Google
    // If someone accesses this URL directly without going through OAuth flow, redirect them
    if (!req.query.code && !req.query.error) {
      console.warn('⚠️  Callback accessed without OAuth parameters. Redirecting to login.')
      const errorUrl = new URL(`${FRONTEND_URL}/login`)
      errorUrl.searchParams.set('error', encodeURIComponent('Invalid OAuth callback. Please try logging in again.'))
      return res.redirect(errorUrl.toString())
    }

    // Check for OAuth errors from Google
    if (req.query.error) {
      console.error('❌ Google OAuth error in callback:', req.query.error, req.query.error_description)
      const errorUrl = new URL(`${FRONTEND_URL}/login`)
      errorUrl.searchParams.set('error', encodeURIComponent(req.query.error_description || req.query.error || 'OAuth error occurred'))
      return res.redirect(errorUrl.toString())
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

    // Authenticate with Google callback
    passport.authenticate('google', async (err, user, info) => {
      if (err) {
        console.error('❌ Google authentication error:', err.message)
        console.error('Error details:', {
          message: err.message,
          stack: err.stack,
          code: err.code
        })
        // Redirect with error message in query param
        const errorUrl = new URL(`${FRONTEND_URL}/login`)
        errorUrl.searchParams.set('error', encodeURIComponent(err.message || 'Google authentication failed'))
        return res.redirect(errorUrl.toString())
      }

      if (!user) {
        console.error('❌ Google authentication returned no user')
        console.error('Info:', info)
        const errorUrl = new URL(`${FRONTEND_URL}/login`)
        errorUrl.searchParams.set('error', encodeURIComponent('User not found or could not be created'))
        return res.redirect(errorUrl.toString())
      }

      // Login user to session
      req.logIn(user, async (loginError) => {
        if (loginError) {
          console.error('Session login error:', loginError)
          const errorUrl = new URL(`${FRONTEND_URL}/login`)
          errorUrl.searchParams.set('error', encodeURIComponent('Session login failed'))
          return res.redirect(errorUrl.toString())
        }

        try {
          // Create JWT tokens for the frontend
          const tokens = createTokens(user)
          
          // Redirect to login page with tokens in URL params
          const redirectUrl = new URL(`${FRONTEND_URL}/login`)
          redirectUrl.searchParams.set('name', user.name || '')
          redirectUrl.searchParams.set('email', user.email || '')
          redirectUrl.searchParams.set('avatar', user.avatar || '')
          redirectUrl.searchParams.set('accessToken', tokens.accessToken)
          redirectUrl.searchParams.set('refreshToken', tokens.refreshToken)

          return res.redirect(redirectUrl.toString())
        } catch (tokenError) {
          console.error('Token creation error:', tokenError)
          // Still redirect to login page but without tokens - frontend can get them from /auth/me
          const redirectUrl = new URL(`${FRONTEND_URL}/login`)
          redirectUrl.searchParams.set('name', user.name || '')
          redirectUrl.searchParams.set('email', user.email || '')
          redirectUrl.searchParams.set('avatar', user.avatar || '')
          return res.redirect(redirectUrl.toString())
        }
      })
    })(req, res)

  } catch (error) {
    console.error('❌ Error in Google OAuth callback:', error.message)
    console.error('Stack:', error.stack)
    const errorUrl = new URL(`${FRONTEND_URL}/login`)
    errorUrl.searchParams.set('error', encodeURIComponent('Authentication failed. Please try again.'))
    return res.redirect(errorUrl.toString())
  }
}

