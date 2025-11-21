/**
 * Google OAuth Token Verification Utility
 * 
 * Verifies Google JWT tokens using google-auth-library
 * Supports multiple client IDs for different environments
 */

import { OAuth2Client } from 'google-auth-library'

/**
 * Verify Google JWT token
 * @param {string} credential - Google JWT credential token
 * @param {string|string[]} clientIds - Google OAuth Client ID(s) to verify against
 * @returns {Promise<Object>} Decoded token payload with user information
 * @throws {Error} If token is invalid, expired, or verification fails
 */
export const verifyGoogleToken = async (credential, clientIds = null) => {
  if (!credential || typeof credential !== 'string') {
    throw new Error('Google credential token is required')
  }

  // Validate credential format (JWT has 3 parts)
  const credentialParts = credential.split('.')
  if (credentialParts.length !== 3) {
    throw new Error('Invalid Google credential token format. Expected JWT format.')
  }

  // Get client IDs from parameter, environment, or use empty array
  let allowedClientIds = []
  
  if (clientIds) {
    // If clientIds is provided, use it
    if (Array.isArray(clientIds)) {
      allowedClientIds = clientIds.filter(id => id && typeof id === 'string')
    } else if (typeof clientIds === 'string') {
      allowedClientIds = [clientIds]
    }
  }
  
  // Add client IDs from environment variable
  if (process.env.GOOGLE_CLIENT_ID) {
    const envClientIds = process.env.GOOGLE_CLIENT_ID
      .split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0)
    
    allowedClientIds = [...allowedClientIds, ...envClientIds]
  }

  // Remove duplicates
  allowedClientIds = [...new Set(allowedClientIds)]

  if (allowedClientIds.length === 0) {
    console.warn('⚠️  No Google OAuth client ID configured. Token audience will not be validated.')
  }

  // Use first client ID for OAuth2Client initialization
  const primaryClientId = allowedClientIds[0] || null
  const client = new OAuth2Client(primaryClientId)

  // Build verification options
  const verifyOptions = {
    idToken: credential
  }

  // Add audience if we have client IDs
  if (allowedClientIds.length > 0) {
    verifyOptions.audience = allowedClientIds.length === 1 ? allowedClientIds[0] : allowedClientIds
  }

  try {
    // Verify the token
    const ticket = await client.verifyIdToken(verifyOptions)
    const payload = ticket.getPayload()

    if (!payload) {
      throw new Error('Invalid Google credential token - no payload received')
    }

    // Validate required fields
    if (!payload.email && !payload.sub) {
      throw new Error('Google token missing required information (email or sub)')
    }

    // Return structured user data
    return {
      email: payload.email,
      name: payload.name || payload.given_name || undefined,
      picture: payload.picture,
      emailVerified: payload.email_verified || false,
      sub: payload.sub, // Google user ID
      // Additional fields
      given_name: payload.given_name,
      family_name: payload.family_name,
      locale: payload.locale
    }
  } catch (error) {
    // Handle specific error types
    if (error.message && (
      error.message.includes('expired') ||
      error.message.includes('Expired') ||
      error.message.includes('used too late') ||
      error.code === 'auth/id-token-expired'
    )) {
      throw new Error('TOKEN_EXPIRED: Google credential token has expired')
    }

    if (error.message && (
      error.message.includes('audience') ||
      error.message.includes('Audience')
    )) {
      throw new Error('AUDIENCE_MISMATCH: Token audience does not match configured client IDs')
    }

    if (error.message && (
      error.message.includes('Invalid token') ||
      error.message.includes('malformed')
    )) {
      throw new Error('INVALID_TOKEN: Invalid Google credential token format')
    }

    // Re-throw with original message
    throw new Error(`Token verification failed: ${error.message}`)
  }
}

/**
 * Extract client ID from request (for logging/debugging)
 * @param {Object} req - Express request object
 * @returns {string|null} Client ID if found
 */
export const extractClientIdFromRequest = (req) => {
  return req.body?.clientId || req.query?.clientId || null
}












