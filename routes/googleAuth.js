import express from 'express'
import passport, { isGoogleAuthConfigured } from '../config/passport.js'
import { createTokens } from '../src/services/otpService.js'

const router = express.Router()

const FRONTEND_URL = process.env.FRONTEND_URL || process.env.FRONTEND_BASE_URL || 'http://localhost:5173'

router.get(
  '/auth/google',
  (req, res, next) => {
    if (!isGoogleAuthConfigured) {
      return res.status(503).json({
        success: false,
        message: 'Google login is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server.'
      })
    }
    next()
  },
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account'
  })
)

router.get(
  '/auth/google/callback',
  (req, res, next) => {
    if (!isGoogleAuthConfigured) {
      return res.redirect('/auth/login-failed')
    }
    passport.authenticate('google', (err, user, info) => {
      if (err) {
        console.error('❌ Google authentication error:', err.message)
        console.error('Error details:', {
          message: err.message,
          stack: err.stack,
          code: err.code
        })
        // Redirect with error message in query param for debugging
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
    })(req, res, next)
  }
)

router.get('/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err)
    }
    req.session?.destroy(() => {
      res.clearCookie('connect.sid')
      res.redirect(FRONTEND_URL)
    })
  })
})

router.get('/auth/login-failed', (req, res) => {
  res.status(401).json({
    success: false,
    message: 'Google login failed'
  })
})

router.get('/auth/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated'
    })
  }

  res.json({
    success: true,
    data: {
      name: req.user.name,
      email: req.user.email,
      avatar: req.user.avatar,
      id: req.user._id
    }
  })
})

export default router

